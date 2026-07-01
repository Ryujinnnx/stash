module stash::marketplace {
    use aptos_framework::event;
    use aptos_framework::timestamp;
    use std::signer;
    use std::string::String;
    use std::table::{Self, Table};

    const ENOT_AUTHORIZED: u64 = 1;
    const EALREADY_INITIALIZED: u64 = 2;
    const ENOT_INITIALIZED: u64 = 3;
    const ELISTING_NOT_FOUND: u64 = 4;
    const EINACTIVE_LISTING: u64 = 5;
    const EINVALID_PRICE: u64 = 6;
    const EEMPTY_STORAGE_ID: u64 = 7;
    const EEMPTY_TITLE: u64 = 8;
    const EEMPTY_CATEGORY: u64 = 9;

    /// Source-of-truth metadata for a dataset or AI model stored on Shelby.
    /// The raw bytes and expanded metadata JSON live in Shelby; this struct
    /// anchors ownership, pricing, lifecycle state, and indexable fields on Aptos.
    struct Listing has copy, drop, store {
        storage_id: String,
        price: u64,
        creator: address,
        title: String,
        description: String,
        category: String,
        tags: vector<String>,
        active: bool,
        created_at: u64,
    }

    struct ListingStore has key {
        listings: Table<u64, Listing>,
        next_listing_id: u64,
    }

    #[event]
    struct ListingCreatedEvent has drop, store {
        listing_id: u64,
        storage_id: String,
        price: u64,
        creator: address,
        title: String,
        description: String,
        category: String,
        tags: vector<String>,
        created_at: u64,
    }

    #[event]
    struct ListingPriceUpdatedEvent has drop, store {
        listing_id: u64,
        creator: address,
        old_price: u64,
        new_price: u64,
        updated_at: u64,
    }

    #[event]
    struct ListingDelistedEvent has drop, store {
        listing_id: u64,
        creator: address,
        delisted_at: u64,
    }

    fun init_module(account: &signer) {
        initialize_internal(account);
    }

    /// Initializes the marketplace registry at the package address.
    /// This is idempotence-protected and should be called by the publishing account.
    public entry fun initialize(account: &signer) {
        initialize_internal(account);
    }

    /// Registers a new Shelby-backed listing and emits a creation event for indexers.
    public entry fun create_listing(
        creator: &signer,
        storage_id: String,
        price: u64,
        title: String,
        description: String,
        category: String,
        tags: vector<String>,
    ) acquires ListingStore {
        assert_initialized();
        assert!(std::string::length(&storage_id) > 0, EEMPTY_STORAGE_ID);
        assert!(price > 0, EINVALID_PRICE);
        assert!(std::string::length(&title) > 0, EEMPTY_TITLE);
        assert!(std::string::length(&category) > 0, EEMPTY_CATEGORY);

        let store = borrow_global_mut<ListingStore>(@stash);
        let listing_id = store.next_listing_id;
        store.next_listing_id = listing_id + 1;

        let creator_address = signer::address_of(creator);
        let created_at = timestamp::now_seconds();
        let listing = Listing {
            storage_id: copy storage_id,
            price,
            creator: creator_address,
            title: copy title,
            description: copy description,
            category: copy category,
            tags: copy tags,
            active: true,
            created_at,
        };

        table::add(&mut store.listings, listing_id, listing);

        event::emit(ListingCreatedEvent {
            listing_id,
            storage_id,
            price,
            creator: creator_address,
            title,
            description,
            category,
            tags,
            created_at,
        });
    }

    /// Updates the active listing price. Only the creator can change price.
    public entry fun update_price(
        creator: &signer,
        listing_id: u64,
        new_price: u64,
    ) acquires ListingStore {
        assert_initialized();
        assert!(new_price > 0, EINVALID_PRICE);

        let store = borrow_global_mut<ListingStore>(@stash);
        assert!(table::contains(&store.listings, listing_id), ELISTING_NOT_FOUND);
        let listing = table::borrow_mut(&mut store.listings, listing_id);
        let creator_address = signer::address_of(creator);
        assert!(listing.creator == creator_address, ENOT_AUTHORIZED);
        assert!(listing.active, EINACTIVE_LISTING);

        let old_price = listing.price;
        listing.price = new_price;

        event::emit(ListingPriceUpdatedEvent {
            listing_id,
            creator: creator_address,
            old_price,
            new_price,
            updated_at: timestamp::now_seconds(),
        });
    }

    /// Delists an active listing. Historical ownership and purchase records remain queryable.
    public entry fun delist(creator: &signer, listing_id: u64) acquires ListingStore {
        assert_initialized();

        let store = borrow_global_mut<ListingStore>(@stash);
        assert!(table::contains(&store.listings, listing_id), ELISTING_NOT_FOUND);
        let listing = table::borrow_mut(&mut store.listings, listing_id);
        let creator_address = signer::address_of(creator);
        assert!(listing.creator == creator_address, ENOT_AUTHORIZED);
        assert!(listing.active, EINACTIVE_LISTING);

        listing.active = false;

        event::emit(ListingDelistedEvent {
            listing_id,
            creator: creator_address,
            delisted_at: timestamp::now_seconds(),
        });
    }

    // Returns a copy of a listing for view functions, tests, and dependent modules.
    #[view]
    public fun get_listing(listing_id: u64): Listing acquires ListingStore {
        assert_initialized();
        assert!(exists_listing(listing_id), ELISTING_NOT_FOUND);
        *table::borrow(&borrow_global<ListingStore>(@stash).listings, listing_id)
    }

    // Returns true when a listing id exists in the marketplace registry.
    #[view]
    public fun exists_listing(listing_id: u64): bool acquires ListingStore {
        exists<ListingStore>(@stash)
            && table::contains(&borrow_global<ListingStore>(@stash).listings, listing_id)
    }

    // Returns the listing price in octas.
    #[view]
    public fun price(listing_id: u64): u64 acquires ListingStore {
        get_listing(listing_id).price
    }

    // Returns the creator that controls the listing.
    #[view]
    public fun creator(listing_id: u64): address acquires ListingStore {
        get_listing(listing_id).creator
    }

    // Returns whether a listing is currently purchasable.
    #[view]
    public fun is_active(listing_id: u64): bool acquires ListingStore {
        get_listing(listing_id).active
    }

    #[test_only]
    public fun init_for_test(account: &signer) {
        initialize_internal(account);
    }

    fun initialize_internal(account: &signer) {
        assert!(signer::address_of(account) == @stash, ENOT_AUTHORIZED);
        assert!(!exists<ListingStore>(@stash), EALREADY_INITIALIZED);

        move_to(account, ListingStore {
            listings: table::new<u64, Listing>(),
            next_listing_id: 0,
        });
    }

    fun assert_initialized() {
        assert!(exists<ListingStore>(@stash), ENOT_INITIALIZED);
    }

}
