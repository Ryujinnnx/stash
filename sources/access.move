module stash::access {
    use aptos_framework::event;
    use aptos_framework::timestamp;
    use stash::marketplace;
    use std::signer;
    use std::table::{Self, Table};
    use std::vector;

    friend stash::payment;

    const ENOT_AUTHORIZED: u64 = 1;
    const EALREADY_INITIALIZED: u64 = 2;
    const ENOT_INITIALIZED: u64 = 3;
    const ELISTING_NOT_FOUND: u64 = 4;

    struct AccessStore has key {
        access_by_buyer: Table<address, vector<u64>>,
    }

    #[event]
    struct AccessGrantedEvent has drop, store {
        buyer: address,
        listing_id: u64,
        granted_at: u64,
    }

    fun init_module(account: &signer) {
        initialize_internal(account);
    }

    /// Initializes the on-chain access ledger at the package address.
    public entry fun initialize(account: &signer) {
        initialize_internal(account);
    }

    /// Grants durable on-chain access after payment has completed.
    /// This function is package-friend gated so arbitrary callers cannot mint access.
    public(friend) fun grant_access(buyer: address, listing_id: u64) acquires AccessStore {
        assert_initialized();
        assert!(marketplace::exists_listing(listing_id), ELISTING_NOT_FOUND);

        if (!verify_access(buyer, listing_id)) {
            let store = borrow_global_mut<AccessStore>(@stash);
            if (!table::contains(&store.access_by_buyer, buyer)) {
                table::add(&mut store.access_by_buyer, buyer, vector[]);
            };

            let listings = table::borrow_mut(&mut store.access_by_buyer, buyer);
            vector::push_back(listings, listing_id);

            event::emit(AccessGrantedEvent {
                buyer,
                listing_id,
                granted_at: timestamp::now_seconds(),
            });
        };
    }

    // Returns true when a buyer has on-chain access to a listing.
    #[view]
    public fun verify_access(buyer: address, listing_id: u64): bool acquires AccessStore {
        if (!exists<AccessStore>(@stash)) {
            return false
        };

        let store = borrow_global<AccessStore>(@stash);
        if (!table::contains(&store.access_by_buyer, buyer)) {
            return false
        };

        vector::contains(table::borrow(&store.access_by_buyer, buyer), &listing_id)
    }

    #[test_only]
    public fun init_for_test(account: &signer) {
        initialize_internal(account);
    }

    fun initialize_internal(account: &signer) {
        assert!(signer::address_of(account) == @stash, ENOT_AUTHORIZED);
        assert!(!exists<AccessStore>(@stash), EALREADY_INITIALIZED);

        move_to(account, AccessStore {
            access_by_buyer: table::new<address, vector<u64>>(),
        });
    }

    fun assert_initialized() {
        assert!(exists<AccessStore>(@stash), ENOT_INITIALIZED);
    }
}
