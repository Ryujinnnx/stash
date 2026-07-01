#[test_only]
module stash::marketplace_test {
    use aptos_framework::account;
    use aptos_framework::aptos_coin;
    use aptos_framework::coin;
    use aptos_framework::timestamp;
    use stash::access;
    use stash::marketplace;
    use stash::payment;
    use std::signer;
    use std::string;

    const STASH: address = @stash;
    const CREATOR: address = @0x100;
    const BUYER: address = @0x200;
    const TREASURY: address = @0x300;

    fun init_all(stash_account: &signer, creator: &signer, buyer: &signer, treasury: &signer) {
        timestamp::set_time_has_started_for_testing(&account::create_signer_for_test(@0x1));
        let (burn_cap, mint_cap) = aptos_coin::initialize_for_test(&account::create_signer_for_test(@0x1));

        account::create_account_for_test(STASH);
        account::create_account_for_test(signer::address_of(creator));
        account::create_account_for_test(signer::address_of(buyer));
        account::create_account_for_test(signer::address_of(treasury));

        coin::register<aptos_coin::AptosCoin>(creator);
        coin::register<aptos_coin::AptosCoin>(buyer);
        coin::register<aptos_coin::AptosCoin>(treasury);

        coin::deposit<aptos_coin::AptosCoin>(
            signer::address_of(buyer),
            coin::mint<aptos_coin::AptosCoin>(100_000_000, &mint_cap),
        );
        coin::destroy_burn_cap(burn_cap);
        coin::destroy_mint_cap(mint_cap);

        marketplace::init_for_test(stash_account);
        access::init_for_test(stash_account);
        payment::init_for_test(stash_account, signer::address_of(treasury));
    }

    fun create_default_listing(creator: &signer) {
        marketplace::create_listing(
            creator,
            string::utf8(b"shelby://blob/dataset-001"),
            10_000_000,
            string::utf8(b"Vision Benchmark Dataset"),
            string::utf8(b"Curated image benchmark data with Shelby-backed metadata."),
            string::utf8(b"dataset"),
            vector[
                string::utf8(b"vision"),
                string::utf8(b"benchmark"),
            ],
        );
    }

    #[test(stash_account = @stash, creator = @0x100, buyer = @0x200, treasury = @0x300)]
    fun create_update_and_delist_listing(
        stash_account: signer,
        creator: signer,
        buyer: signer,
        treasury: signer,
    ) {
        init_all(&stash_account, &creator, &buyer, &treasury);
        create_default_listing(&creator);

        marketplace::get_listing(0);
        assert!(marketplace::price(0) == 10_000_000, 0);
        assert!(marketplace::creator(0) == CREATOR, 1);
        assert!(marketplace::is_active(0), 2);

        marketplace::update_price(&creator, 0, 12_500_000);
        assert!(marketplace::price(0) == 12_500_000, 3);

        marketplace::delist(&creator, 0);
        assert!(!marketplace::is_active(0), 4);
    }

    #[test(stash_account = @stash, creator = @0x100, buyer = @0x200, treasury = @0x300)]
    fun purchase_grants_access_and_accrues_revenue(
        stash_account: signer,
        creator: signer,
        buyer: signer,
        treasury: signer,
    ) {
        init_all(&stash_account, &creator, &buyer, &treasury);
        create_default_listing(&creator);

        payment::purchase(&buyer, 0);

        assert!(payment::has_purchased(BUYER, 0), 0);
        assert!(access::verify_access(BUYER, 0), 1);
        assert!(payment::claimable_revenue(0) == 9_750_000, 2);

        payment::claim_revenue(&creator, 0);
        assert!(payment::claimable_revenue(0) == 0, 3);
    }

    #[test(stash_account = @stash, creator = @0x100, buyer = @0x200, treasury = @0x300)]
    #[expected_failure(abort_code = 6, location = stash::payment)]
    fun cannot_purchase_twice(
        stash_account: signer,
        creator: signer,
        buyer: signer,
        treasury: signer,
    ) {
        init_all(&stash_account, &creator, &buyer, &treasury);
        create_default_listing(&creator);

        payment::purchase(&buyer, 0);
        payment::purchase(&buyer, 0);
    }

    #[test(stash_account = @stash, creator = @0x100, buyer = @0x200, treasury = @0x300)]
    #[expected_failure(abort_code = 1, location = stash::marketplace)]
    fun only_creator_can_update_price(
        stash_account: signer,
        creator: signer,
        buyer: signer,
        treasury: signer,
    ) {
        init_all(&stash_account, &creator, &buyer, &treasury);
        create_default_listing(&creator);

        marketplace::update_price(&buyer, 0, 12_500_000);
    }
}
