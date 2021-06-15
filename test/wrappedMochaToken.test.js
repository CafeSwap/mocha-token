const { expectRevert, ZERO_ADDRESS } = require('@openzeppelin/test-helpers');
const wMOCHA = artifacts.require('wMOCHA');
const MochaToken = artifacts.require('MochaToken');

contract('wMOCHA', ([alice, bob, carol, fee]) => {
    beforeEach(async () => {
        this.mocha = await MochaToken.new(fee, alice, {from: alice });
        this.wMocha = await wMOCHA.new(this.mocha.address, fee, alice, { from: alice });
        await this.mocha.setWhiteListAccount(this.wMocha.address, true, { from: alice });
        await this.wMocha.setWhiteListAccount(this.mocha.address, true, { from: alice });
        await this.mocha.approve(this.wMocha.address, '10000000000000000000000000000', {from: alice});
        await this.mocha.approve(this.wMocha.address, '10000000000000000000000000000', {from: bob});
        await this.mocha.approve(this.wMocha.address, '10000000000000000000000000000', {from: carol});
      });

    it('should have correct name and symbol and decimal', async () => {
        const name = await this.wMocha.name();
        const symbol = await this.wMocha.symbol();
        const decimals = await this.wMocha.decimals();
        assert.equal(name.valueOf(), 'Wrapped MOCHA');
        assert.equal(symbol.valueOf(), 'wMOCHA');
        assert.equal(decimals.valueOf(), '18');
    });

    it('should deposit/withdraw wMocha using mocha', async () => {
        await this.mocha.mint(alice, '100000', { from: alice });

        assert.equal(await this.mocha.balanceOf(alice).valueOf(), '100000');

        await this.wMocha.deposit('100000', { from: alice });

        assert.equal(await this.wMocha.balanceOf(alice).valueOf(), '100000');
        assert.equal(await this.wMocha.totalSupply().valueOf(), '100000');

        await this.wMocha.withdraw('100000', { from: alice });

        assert.equal(await this.mocha.balanceOf(alice).valueOf(), '100000');
        assert.equal(await this.wMocha.totalSupply().valueOf(), '0');
        assert.equal(await this.mocha.totalSupply().valueOf(), '100000');
      });

    it('should supply token transfers properly with fee deduction and is feeAddress 0.1% token on each transfers ', async () => {

        await this.mocha.mint(alice, web3.utils.toWei('100'), { from: alice });
        await this.mocha.mint(bob, web3.utils.toWei('200'), { from: alice });

        await this.wMocha.deposit(web3.utils.toWei('100'), { from: alice });
        await this.wMocha.deposit(web3.utils.toWei('200'), { from: bob });

        await this.wMocha.transfer(carol, web3.utils.toWei('10'), { from: alice });
        await this.wMocha.transfer(carol, web3.utils.toWei('100'), { from: bob });

        const totalSupply = await this.wMocha.totalSupply();
        const aliceBal = await this.wMocha.balanceOf(alice);
        const bobBal = await this.wMocha.balanceOf(bob);
        const carolBal = await this.wMocha.balanceOf(carol);
        const FeeBal = await this.wMocha.balanceOf(fee);
        const deadBal = await this.wMocha.balanceOf("0x000000000000000000000000000000000000dEaD");

        // Total supply shouldn't change as we are sending it to a 0x00deaD address
        assert.equal(web3.utils.fromWei((totalSupply).toString()), '300');
        assert.equal(web3.utils.fromWei(deadBal.toString()), '0.99');
        assert.equal(web3.utils.fromWei(aliceBal.toString()), '90');
        assert.equal(web3.utils.fromWei(bobBal.toString()), '100');
        assert.equal(web3.utils.fromWei(carolBal.toString()), '108.9');
        assert.equal(web3.utils.fromWei(FeeBal.toString()), '0.11');
    });

    it('should supply token transfers properly with fee deduction and is feeAddress 0.1% token on each transfers ', async () => {    
        await this.mocha.mint(alice, web3.utils.toWei('100'), { from: alice });
        await this.mocha.mint(bob, web3.utils.toWei('200'), { from: alice });

        await this.wMocha.deposit(web3.utils.toWei('100'), { from: alice });
        await this.wMocha.deposit(web3.utils.toWei('200'), { from: bob });

        await this.wMocha.approve(carol, web3.utils.toWei('10'), { from: alice });
        await this.wMocha.approve(carol, web3.utils.toWei('100'), { from: bob });

        await this.wMocha.transferFrom(alice,carol, web3.utils.toWei('10'), { from: carol });
        await this.wMocha.transferFrom(bob,carol, web3.utils.toWei('100'), { from: carol });

        const totalSupply = await this.wMocha.totalSupply();
        const aliceBal = await this.wMocha.balanceOf(alice);
        const bobBal = await this.wMocha.balanceOf(bob);
        const carolBal = await this.wMocha.balanceOf(carol);
        const FeeBal = await this.wMocha.balanceOf(fee);
        const deadBal = await this.wMocha.balanceOf("0x000000000000000000000000000000000000dEaD");

        // Total supply shouldn't change as we are sending it to a 0x00deaD address
        assert.equal(web3.utils.fromWei((totalSupply).toString()), '300');
        assert.equal(web3.utils.fromWei(deadBal.toString()), '0.99');
        assert.equal(web3.utils.fromWei(aliceBal.toString()), '90');
        assert.equal(web3.utils.fromWei(bobBal.toString()), '100');
        assert.equal(web3.utils.fromWei(carolBal.toString()), '108.9');
        assert.equal(web3.utils.fromWei(FeeBal.toString()), '0.11');
    });

    it('should supply token transfers properly with no fee deduction if sender or receiver address is whiteList ', async () => {
        await this.mocha.mint(alice, web3.utils.toWei('100'), { from: alice });
        await this.mocha.mint(bob, web3.utils.toWei('200'), { from: alice });

        await this.wMocha.deposit(web3.utils.toWei('100'), { from: alice });
        await this.wMocha.deposit(web3.utils.toWei('200'), { from: bob });

        await this.wMocha.approve(carol, web3.utils.toWei('10'), { from: alice });
        await this.wMocha.approve(carol, web3.utils.toWei('100'), { from: bob });

        await this.wMocha.setWhiteListAccount(alice,true,{from:alice})
        await this.wMocha.transferFrom(alice,carol, web3.utils.toWei('10'), { from: carol });
        await this.wMocha.setWhiteListAccount(carol,true,{from:alice})
        await this.wMocha.transferFrom(bob,carol, web3.utils.toWei('100'), { from: carol });
        await this.wMocha.setWhiteListAccount(carol,false,{from:alice})


        const totalSupply = await this.wMocha.totalSupply();
        const aliceBal = await this.wMocha.balanceOf(alice);
        const bobBal = await this.wMocha.balanceOf(bob);
        const carolBal = await this.wMocha.balanceOf(carol);
        const FeeBal = await this.wMocha.balanceOf(fee);
        const deadBal = await this.wMocha.balanceOf("0x000000000000000000000000000000000000dEaD");

        assert.equal(web3.utils.fromWei((totalSupply).toString()), '300');
        assert.equal(web3.utils.fromWei(aliceBal.toString()), '90');
        assert.equal(web3.utils.fromWei(bobBal.toString()), '100');
        assert.equal(web3.utils.fromWei(carolBal.toString()), '110');
        assert.equal(web3.utils.fromWei(FeeBal.toString()), '0');

        await this.wMocha.transfer(carol, web3.utils.toWei('1'), { from: bob });
        assert.equal(web3.utils.fromWei((await this.wMocha.balanceOf(carol)).toString()), '110.99');
        assert.equal(web3.utils.fromWei((await this.wMocha.balanceOf(fee)).toString()), '0.001');
        assert.equal(web3.utils.fromWei((await this.wMocha.totalSupply()).toString()), '300');
        assert.equal(web3.utils.fromWei(deadBal.toString()), '0');
    });
  });
