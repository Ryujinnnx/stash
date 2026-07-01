module stash::payment {
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::coin::{Self, Coin};
    use aptos_framework::event;
    use aptos_framework::timestamp;
    use stash::access;
    use stash::marketplace;
    use std::signer;
    use std::table::{Self, Table};
    use std::vector;

    const PROTOCOL_FEE_BPS: u64 = 250;
    const BPS_DENOMINATOR: u64 = 10000;

    const ENOT_AUTHORIZED: u64 = 1;
    const EALREADY_INITIALIZED: u64 = 2;
    const ENOT_INITIALIZED: u64 = 3;
    const ELISTING_NOT_FOUND: u64 = 4;
    const EINACTIVE_LISTING: u64 = 5;
    const EALREADY_PURCHASED: u64 = 6;
    const ECANNOT_BUY_OWN_LISTING: u64 = 7;
    const ENO_REVENUE: u64 = 8;

    struct PaymentStore has key {
        treasury: address,
        escrow: Coin<AptosCoin>,
        revenue_by_listing: Table<u64, u64>,
        purchases_by_buyer: Table<address, vector<u64>>,
    }

    #[event]
    struct TreasuryUpdatedEvent has drop, store {
        old_treasury: address,
        new_treasury: address,
        updated_at: u64,
    }

    #[event]
    struct PurchaseEvent has drop, store {
        listing_id: u64,
        buyer: address,
        creator: address,
        gross_amount: u64,
        creator_amount: u64,
        protocol_fee: u64,
        purchased_at: u64,
    }

    #[event]
    struct RevenueClaimedEvent has drop, store {
        listing_id: u64,
        creator: address,
        amount: u64,
        claimed_at: u64,
    }

    fun init_module(account: &signer) {
        initialize_internal(account, signer::address_of(account));
    }

    /// Initializes payment escrow and sets the protocol treasury address.
    public entry fun initialize(account: &signer, treasury: address) {
        initialize_internal(account, treasury);
    }

    /// Updates the protocol fee recipient. Only the package account can rotate treasury.
    public entry fun set_treasury(account: &signer, new_treasury: address) acquires PaymentStore {
        assert!(signer::address_of(account) == @stash, ENOT_AUTHORIZED);
        assert_initialized();

        let store = borrow_global_mut<PaymentStore>(@stash);
        let old_treasury = store.treasury;
        store.treasury = new_treasury;

        event::emit(TreasuryUpdatedEvent {
            old_treasury,
            new_treasury,
            updated_at: timestamp::now_seconds(),
        });
    }

    /// Purchases an active listing with APT, escrows creator revenue, pays protocol fees,
    /// records the purchase, and atomically grants access.
    public entry fun purchase(buyer: &signer, listing_id: u64) acquires PaymentStore {
        assert_initialized();
        assert!(marketplace::exists_listing(listing_id), ELISTING_NOT_FOUND);
        assert!(marketplace::is_active(listing_id), EINACTIVE_LISTING);

        let buyer_address = signer::address_of(buyer);
        let creator = marketplace::creator(listing_id);
        assert!(buyer_address != creator, ECANNOT_BUY_OWN_LISTING);
        assert!(!has_purchased(buyer_address, listing_id), EALREADY_PURCHASED);

        let price = marketplace::price(listing_id);
        let protocol_fee = protocol_fee(price);
        let creator_amount = price - protocol_fee;

        let paid = coin::withdraw<AptosCoin>(buyer, price);
        let fee_coin = coin::extract(&mut paid, protocol_fee);

        let store = borrow_global_mut<PaymentStore>(@stash);
        coin::deposit<AptosCoin>(store.treasury, fee_coin);
        coin::merge(&mut store.escrow, paid);
        add_revenue(&mut store.revenue_by_listing, listing_id, creator_amount);
        record_purchase(&mut store.purchases_by_buyer, buyer_address, listing_id);

        access::grant_access(buyer_address, listing_id);

        event::emit(PurchaseEvent {
            listing_id,
            buyer: buyer_address,
            creator,
            gross_amount: price,
            creator_amount,
            protocol_fee,
            purchased_at: timestamp::now_seconds(),
        });
    }

    /// Claims accrued creator revenue for a listing from protocol escrow.
    public entry fun claim_revenue(creator: &signer, listing_id: u64) acquires PaymentStore {
        assert_initialized();
        assert!(marketplace::exists_listing(listing_id), ELISTING_NOT_FOUND);

        let creator_address = signer::address_of(creator);
        assert!(marketplace::creator(listing_id) == creator_address, ENOT_AUTHORIZED);

        let store = borrow_global_mut<PaymentStore>(@stash);
        let amount = claimable_revenue_internal(store, listing_id);
        assert!(amount > 0, ENO_REVENUE);

        *table::borrow_mut(&mut store.revenue_by_listing, listing_id) = 0;
        let revenue = coin::extract(&mut store.escrow, amount);
        coin::deposit<AptosCoin>(creator_address, revenue);

        event::emit(RevenueClaimedEvent {
            listing_id,
            creator: creator_address,
            amount,
            claimed_at: timestamp::now_seconds(),
        });
    }

    // Returns whether a buyer has already purchased a listing.
    #[view]
    public fun has_purchased(buyer: address, listing_id: u64): bool acquires PaymentStore {
        if (!exists<PaymentStore>(@stash)) {
            return false
        };

        let store = borrow_global<PaymentStore>(@stash);
        if (!table::contains(&store.purchases_by_buyer, buyer)) {
            return false
        };

        vector::contains(table::borrow(&store.purchases_by_buyer, buyer), &listing_id)
    }

    // Returns claimable creator revenue for a listing in octas.
    #[view]
    public fun claimable_revenue(listing_id: u64): u64 acquires PaymentStore {
        assert_initialized();
        claimable_revenue_internal(borrow_global<PaymentStore>(@stash), listing_id)
    }

    #[test_only]
    public fun init_for_test(account: &signer, treasury: address) {
        initialize_internal(account, treasury);
    }

    fun initialize_internal(account: &signer, treasury: address) {
        assert!(signer::address_of(account) == @stash, ENOT_AUTHORIZED);
        assert!(!exists<PaymentStore>(@stash), EALREADY_INITIALIZED);

        move_to(account, PaymentStore {
            treasury,
            escrow: coin::zero<AptosCoin>(),
            revenue_by_listing: table::new<u64, u64>(),
            purchases_by_buyer: table::new<address, vector<u64>>(),
        });
    }

    fun assert_initialized() {
        assert!(exists<PaymentStore>(@stash), ENOT_INITIALIZED);
    }

    fun protocol_fee(price: u64): u64 {
        (((price as u128) * (PROTOCOL_FEE_BPS as u128)) / (BPS_DENOMINATOR as u128) as u64)
    }

    fun add_revenue(revenue_by_listing: &mut Table<u64, u64>, listing_id: u64, amount: u64) {
        if (table::contains(revenue_by_listing, listing_id)) {
            let revenue = table::borrow_mut(revenue_by_listing, listing_id);
            *revenue = *revenue + amount;
        } else {
            table::add(revenue_by_listing, listing_id, amount);
        };
    }

    fun record_purchase(purchases_by_buyer: &mut Table<address, vector<u64>>, buyer: address, listing_id: u64) {
        if (!table::contains(purchases_by_buyer, buyer)) {
            table::add(purchases_by_buyer, buyer, vector[]);
        };

        vector::push_back(table::borrow_mut(purchases_by_buyer, buyer), listing_id);
    }

    fun claimable_revenue_internal(store: &PaymentStore, listing_id: u64): u64 {
        if (!table::contains(&store.revenue_by_listing, listing_id)) {
            return 0
        };

        *table::borrow(&store.revenue_by_listing, listing_id)
    }
}
