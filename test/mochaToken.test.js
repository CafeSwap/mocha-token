const { expectRevert, ZERO_ADDRESS } = require('@openzeppelin/test-helpers');
const MochaToken = artifacts.require('MochaToken');

contract('MochaToken', ([alice, bob, carol, fee]) => {
    beforeEach(async () => {
        this.Mocha = await MochaToken.new(fee, { from: alice });
    });

    it('should have correct name and symbol and decimal', async () => {
        const name = await this.Mocha.name();
        const symbol = await this.Mocha.symbol();
        const decimals = await this.Mocha.decimals();
        assert.equal(name.valueOf(), 'MochaToken');
        assert.equal(symbol.valueOf(), 'MOCHA');
        assert.equal(decimals.valueOf(), '18');
    });

    it('should only allow owner to mint token', async () => {
        await this.Mocha.mint(alice, web3.utils.toWei('100'), { from: alice });
        await this.Mocha.mint(bob, web3.utils.toWei('1000'), { from: alice });
        await expectRevert(
            this.Mocha.mint(carol, web3.utils.toWei('1000'), { from: bob }),
            'Ownable: caller is not the owner',
        );
        const totalSupply = await this.Mocha.totalSupply();
        const aliceBal = await this.Mocha.balanceOf(alice);
        const bobBal = await this.Mocha.balanceOf(bob);
        const carolBal = await this.Mocha.balanceOf(carol);
        assert.equal(totalSupply.valueOf(), web3.utils.toWei('1100'));
        assert.equal(aliceBal.valueOf(), web3.utils.toWei('100'));
        assert.equal(bobBal.valueOf(), web3.utils.toWei('1000'));
        assert.equal(carolBal.valueOf(), '0');
    });

    it('should supply token transfers properly with fee deduction and is feeAddress 0.1% token on each transfers ', async () => {
        await this.Mocha.mint(alice, web3.utils.toWei('100'), { from: alice });
        await this.Mocha.mint(bob, web3.utils.toWei('200'), { from: alice });
        await this.Mocha.transfer(carol, web3.utils.toWei('10'), { from: alice });
        await this.Mocha.transfer(carol, web3.utils.toWei('100'), { from: bob });
        const totalSupply = await this.Mocha.totalSupply();
        const aliceBal = await this.Mocha.balanceOf(alice);
        const bobBal = await this.Mocha.balanceOf(bob);
        const carolBal = await this.Mocha.balanceOf(carol);
        const FeeBal = await this.Mocha.balanceOf(fee);

        // console.log("totalSupply",web3.utils.fromWei((totalSupply).toString()))
        assert.equal(web3.utils.fromWei((totalSupply).toString()), '299.01');
        assert.equal(web3.utils.fromWei(aliceBal.toString()), '90');
        assert.equal(web3.utils.fromWei(bobBal.toString()), '100');
        assert.equal(web3.utils.fromWei(carolBal.toString()), '108.9');
        assert.equal(web3.utils.fromWei(FeeBal.toString()), '0.11');
    });

    it('should supply token transfers properly with fee deduction and is feeAddress 0.1% token on each transfers ', async () => {
        await this.Mocha.mint(alice, web3.utils.toWei('100'), { from: alice });
        await this.Mocha.mint(bob, web3.utils.toWei('200'), { from: alice });
    
        await this.Mocha.approve(carol, web3.utils.toWei('10'), { from: alice });
        await this.Mocha.approve(carol, web3.utils.toWei('100'), { from: bob });

        await this.Mocha.transferFrom(alice,carol, web3.utils.toWei('10'), { from: carol });
        await this.Mocha.transferFrom(bob,carol, web3.utils.toWei('100'), { from: carol });

        const totalSupply = await this.Mocha.totalSupply();
        const aliceBal = await this.Mocha.balanceOf(alice);
        const bobBal = await this.Mocha.balanceOf(bob);
        const carolBal = await this.Mocha.balanceOf(carol);
        const FeeBal = await this.Mocha.balanceOf(fee);

        // console.log("totalSupply",web3.utils.fromWei((totalSupply).toString()))
        assert.equal(web3.utils.fromWei((totalSupply).toString()), '299.01');
        assert.equal(web3.utils.fromWei(aliceBal.toString()), '90');
        assert.equal(web3.utils.fromWei(bobBal.toString()), '100');
        assert.equal(web3.utils.fromWei(carolBal.toString()), '108.9');
        assert.equal(web3.utils.fromWei(FeeBal.toString()), '0.11');
    });
    it('should not mint more than 500k ', async () => {
        await this.Mocha.mint(alice, web3.utils.toWei('100'), { from: alice });
        await this.Mocha.mint(bob, web3.utils.toWei('200'), { from: alice });
    
        await this.Mocha.approve(carol, web3.utils.toWei('10'), { from: alice });
        await this.Mocha.approve(carol, web3.utils.toWei('100'), { from: bob });

        await this.Mocha.transferFrom(alice,carol, web3.utils.toWei('10'), { from: carol });
        await this.Mocha.transferFrom(bob,carol, web3.utils.toWei('100'), { from: carol });

        const totalSupply = await this.Mocha.totalSupply();
        const aliceBal = await this.Mocha.balanceOf(alice);
        const bobBal = await this.Mocha.balanceOf(bob);
        const carolBal = await this.Mocha.balanceOf(carol);
        const FeeBal = await this.Mocha.balanceOf(fee);

        // console.log("totalSupply",web3.utils.fromWei((totalSupply).toString()))
        assert.equal(web3.utils.fromWei((totalSupply).toString()), '299.01');
        assert.equal(web3.utils.fromWei(aliceBal.toString()), '90');
        assert.equal(web3.utils.fromWei(bobBal.toString()), '100');
        assert.equal(web3.utils.fromWei(carolBal.toString()), '108.9');
        assert.equal(web3.utils.fromWei(FeeBal.toString()), '0.11');

        
        await expectRevert(
            this.Mocha.mint(bob, web3.utils.toWei('500000'), { from: alice }),
            'Supply is greater than HARD_CAP',
        );
        await this.Mocha.mint(bob, web3.utils.toWei('499700'), { from: alice });

        await expectRevert(
            this.Mocha.mint(bob, web3.utils.toWei('1'), { from: alice }),
            'Supply is greater than HARD_CAP',
        );

        await expectRevert(
            this.Mocha.mint(bob, web3.utils.toWei('0'), { from: bob }),
            'Ownable: caller is not the owner',
        );
        await expectRevert(
            this.Mocha.burn(bob, web3.utils.toWei('0'), { from: bob }),
            'Ownable: caller is not the owner',
        );

        await expectRevert(
            this.Mocha.whiteListAccount(bob, 'true', { from: bob }),
            'caller is not the admin',
        );

        await expectRevert(
            this.Mocha.setRewardAddress(bob, { from: bob }),
            'Ownable: caller is not the owner',
        );


        await expectRevert(
            this.Mocha.setRewardAddress("0x0000000000000000000000000000000000000000", { from: alice }),
            'zero address',
        );
        
        await this.Mocha.transferOwnership(carol,{from:alice})

        await expectRevert(
            this.Mocha.whiteListAccount(bob, 1, { from: carol }),
            'caller is not the admin',
        );

        await this.Mocha.whiteListAccount(alice,true,{from:alice})



    });

    it('should supply token transfers properly with no fee deduction if sender or receiver address is whiteList ', async () => {
        await this.Mocha.mint(alice, web3.utils.toWei('100'), { from: alice });
        await this.Mocha.mint(bob, web3.utils.toWei('200'), { from: alice });
        await this.Mocha.transferOwnership(carol,{from:alice})

        await this.Mocha.approve(carol, web3.utils.toWei('10'), { from: alice });
        await this.Mocha.approve(carol, web3.utils.toWei('100'), { from: bob });

        await this.Mocha.whiteListAccount(alice,true,{from:alice})
        await this.Mocha.transferFrom(alice,carol, web3.utils.toWei('10'), { from: carol });
        await this.Mocha.whiteListAccount(carol,true,{from:alice})
        await this.Mocha.transferFrom(bob,carol, web3.utils.toWei('100'), { from: carol });
        await this.Mocha.whiteListAccount(carol,false,{from:alice})


        const totalSupply = await this.Mocha.totalSupply();
        const aliceBal = await this.Mocha.balanceOf(alice);
        const bobBal = await this.Mocha.balanceOf(bob);
        const carolBal = await this.Mocha.balanceOf(carol);
        const FeeBal = await this.Mocha.balanceOf(fee);

        // console.log("totalSupply",web3.utils.fromWei((totalSupply).toString()))
        assert.equal(web3.utils.fromWei((totalSupply).toString()), '300');
        assert.equal(web3.utils.fromWei(aliceBal.toString()), '90');
        assert.equal(web3.utils.fromWei(bobBal.toString()), '100');
        assert.equal(web3.utils.fromWei(carolBal.toString()), '110');
        assert.equal(web3.utils.fromWei(FeeBal.toString()), '0');

        await this.Mocha.transfer(carol, web3.utils.toWei('1'), { from: bob });
        assert.equal(web3.utils.fromWei((await this.Mocha.balanceOf(carol)).toString()), '110.99');
        assert.equal(web3.utils.fromWei((await this.Mocha.balanceOf(fee)).toString()), '0.001');
        assert.equal(web3.utils.fromWei((await this.Mocha.totalSupply()).toString()), '299.991');


    });


    it('should fail if you try to do bad transfers', async () => {
        await this.Mocha.mint(alice, web3.utils.toWei('100'), { from: alice });
        await expectRevert(
            this.Mocha.transfer(carol, web3.utils.toWei('110'), { from: alice }),
            'BEP20: transfer amount exceeds balance',
        );
        await expectRevert(
            this.Mocha.transfer(carol, '1', { from: bob }),
            'BEP20: transfer amount exceeds balance',
        );
    });
  });
