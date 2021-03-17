const {
  BN,
  constants,
  ether,
  expectRevert,
  time,
} = require('@openzeppelin/test-helpers');
const { duration, increase, latest } = time;
const abi = require('ethereumjs-abi');
const utils = web3.utils;
const { expect } = require('chai');
const { evmRevert, evmSnapshot } = require('./utils/utils');

const { COMBO_TOKEN, COMBO_PROVIDER } = require('./utils/constants');

const RCOMBO = artifacts.require('RCOMBO');
const IToken = artifacts.require('IERC20');

contract('RCOMBO', function([_, user, someone]) {
  before(async function() {
    const totalSupply = 50000; // 0.05 M
    this.token = await IToken.at(COMBO_TOKEN);
    this.totalSupply = ether(totalSupply.toString());
    this.start = await latest();
    this.durationDay = 360;
    this.duration = duration.days(this.durationDay);
    this.rCombo = await RCOMBO.new(totalSupply, this.start);
    await this.token.transfer(this.rCombo.address, this.totalSupply, {
      from: COMBO_PROVIDER,
    });
    expect(
      await this.token.balanceOf.call(this.rCombo.address)
    ).to.be.bignumber.eq(this.totalSupply);
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Transfer rCombo', function() {
    it('transfer', async function() {
      expect(await this.rCombo.totalSupply()).to.be.bignumber.eq(
        this.totalSupply
      );
      expect(await this.rCombo.decimals()).to.be.bignumber.eq(new BN('18'));
      expect(await this.rCombo.symbol()).to.be.eq('RCOMBO');
      expect(await this.rCombo.name()).to.be.eq('Furucombo IOU COMBO Token');
      expect(await this.rCombo.balanceOf.call(_)).to.be.bignumber.eq(
        this.totalSupply
      );

      const amount = this.totalSupply.div(new BN(10));
      await this.rCombo.transfer(user, amount, { from: _ });
      expect(await this.rCombo.balanceOf.call(user)).to.be.bignumber.eq(amount);
    });

    it('transferFrom rCombo', async function() {
      const amount = this.totalSupply.div(new BN(10));
      await this.rCombo.approve(user, amount, { from: _ });
      await this.rCombo.transferFrom(_, user, amount, { from: user });
      expect(await this.rCombo.balanceOf.call(user)).to.be.bignumber.eq(amount);
    });
  });

  describe('ERC20Recovery', function() {
    it('should revert HEGIC tokens only from owner account', async function() {
      await expectRevert(
        this.rCombo.recoverERC20(this.token.address, { from: user }),
        'Ownable: caller is not the owner'
      );
    });

    it('HEGIC should be zero after executing recoverERC20', async function() {
      await this.rCombo.recoverERC20(this.token.address, { from: _ });
      expect(await this.token.balanceOf.call(this.rCombo.address)).to.be.zero;
    });
  });

  describe('Provide RCOMBO', function() {
    let tokenUser;
    let tokenOwner;
    let iouTokenUser;
    let iouTokenOwner;

    beforeEach(async function() {
      let amount = ether('1000');
      await this.rCombo.transfer(user, amount, { from: _ });
      tokenUser = await this.token.balanceOf.call(user);
      tokenOwner = await this.token.balanceOf.call(_);
      iouTokenUser = await this.rCombo.balanceOf.call(user);
      iouTokenOwner = await this.rCombo.balanceOf.call(_);
    });

    it('user provide rCombo', async function() {
      const provideAmount = ether('10');
      await this.rCombo.approve(this.rCombo.address, provideAmount, {
        from: user,
      });
      await this.rCombo.provide(provideAmount, { from: user });

      expect(await this.rCombo.balanceOf.call(user)).to.be.bignumber.eq(
        iouTokenUser.sub(provideAmount)
      );

      expect(await this.rCombo.provided.call(user)).to.be.bignumber.eq(
        provideAmount
      );
    });

    it('provide rCombo for user', async function() {
      const provideAmount = ether('10');
      await this.rCombo.provideFor(user, provideAmount, { from: _ });
      expect(await this.rCombo.balanceOf.call(_)).to.be.bignumber.eq(
        iouTokenOwner.sub(provideAmount)
      );

      expect(await this.rCombo.provided.call(user)).to.be.bignumber.eq(
        provideAmount
      );
    });

    it('provide rCombo twice', async function() {
      const provideAmount1 = ether('10');
      await this.rCombo.approve(this.rCombo.address, provideAmount1, {
        from: user,
      });
      await this.rCombo.provide(provideAmount1, { from: user });

      expect(await this.rCombo.balanceOf.call(user)).to.be.bignumber.eq(
        iouTokenUser.sub(provideAmount1)
      );

      expect(await this.rCombo.provided.call(user)).to.be.bignumber.eq(
        provideAmount1
      );

      const provideAmount2 = ether('100');
      await this.rCombo.approve(this.rCombo.address, provideAmount2, {
        from: user,
      });
      await this.rCombo.provide(provideAmount2, { from: user });
      expect(await this.rCombo.balanceOf.call(user)).to.be.bignumber.eq(
        iouTokenUser.sub(provideAmount1.add(provideAmount2))
      );
      expect(await this.rCombo.provided.call(user)).to.be.bignumber.eq(
        provideAmount1.add(provideAmount2)
      );
    });

    it('provide rCombo for user twice', async function() {
      const provideAmount1 = ether('10');
      await this.rCombo.provideFor(user, provideAmount1, { from: _ });
      expect(await this.rCombo.balanceOf.call(_)).to.be.bignumber.eq(
        iouTokenOwner.sub(provideAmount1)
      );
      expect(await this.rCombo.provided.call(user)).to.be.bignumber.eq(
        provideAmount1
      );

      const provideAmount2 = ether('100');
      await this.rCombo.provideFor(user, provideAmount2, { from: _ });
      expect(await this.rCombo.balanceOf.call(_)).to.be.bignumber.eq(
        iouTokenOwner.sub(provideAmount1.add(provideAmount2))
      );
      expect(await this.rCombo.provided.call(user)).to.be.bignumber.eq(
        provideAmount1.add(provideAmount2)
      );
    });

    it('Should revert: that provide exceeds balance', async function() {
      const provideAmount = ether('2000');
      await this.rCombo.approve(this.rCombo.address, provideAmount, {
        from: user,
      });
      await expectRevert(
        this.rCombo.provide(provideAmount, { from: user }),
        'ERC20: transfer amount exceeds balance'
      );
    });

    it('Should revert: that provideFor exceeds balance', async function() {
      await expectRevert(
        this.rCombo.provideFor(user, iouTokenOwner.add(ether('1')), {
          from: _,
        }),
        'ERC20: transfer amount exceeds balance'
      );
    });
  });

  describe('Withdraw COMBO', function() {
    let tokenUser;
    let providedUser;
    let releasedUser;
    let provideAmount;

    beforeEach(async function() {
      let amount = ether('1000');
      await this.rCombo.transfer(user, amount, { from: _ });
      expect(await this.rCombo.balanceOf.call(user)).to.be.bignumber.eq(amount);

      provideAmount = ether('100');
      await this.rCombo.provideFor(user, provideAmount, { from: _ });
      expect(await this.rCombo.provided.call(user)).to.be.bignumber.eq(
        provideAmount
      );

      tokenUser = await this.token.balanceOf.call(user);
      providedUser = await this.rCombo.provided.call(user);
      releasedUser = await this.rCombo.released.call(user);
    });

    it('withdraw COMBO 20%', async function() {
      const increaseDay = (this.durationDay * 20) / 100;
      await increase(duration.days(increaseDay.toString()));
      const tx = await this.rCombo.withdraw({ from: user });

      const tokenUserEnd = await this.token.balanceOf.call(user);
      const releasedUserEnd = await this.rCombo.released.call(user);
      const block = await web3.eth.getBlock(tx.receipt.blockNumber);
      const expectClaim = provideAmount
        .mul(utils.toBN(block.timestamp).sub(this.start))
        .div(this.duration);
      expect(tokenUserEnd.sub(tokenUser)).to.be.bignumber.eq(expectClaim);
      expect(releasedUserEnd.sub(releasedUser)).to.be.bignumber.eq(expectClaim);
    });

    it('withdraw COMBO 40%', async function() {
      const increaseDay = (this.durationDay * 40) / 100;
      await increase(duration.days(increaseDay.toString()));
      const tx = await this.rCombo.withdraw({ from: user });

      const tokenUserEnd = await this.token.balanceOf.call(user);
      const releasedUserEnd = await this.rCombo.released.call(user);
      const block = await web3.eth.getBlock(tx.receipt.blockNumber);
      const expectClaim = provideAmount
        .mul(utils.toBN(block.timestamp).sub(this.start))
        .div(this.duration);
      expect(tokenUserEnd.sub(tokenUser)).to.be.bignumber.eq(expectClaim);
      expect(releasedUserEnd.sub(releasedUser)).to.be.bignumber.eq(expectClaim);
    });

    it('withdraw COMBO 60%', async function() {
      const increaseDay = (this.durationDay * 60) / 100;
      await increase(duration.days(increaseDay.toString()));
      const tx = await this.rCombo.withdraw({ from: user });

      const tokenUserEnd = await this.token.balanceOf.call(user);
      const releasedUserEnd = await this.rCombo.released.call(user);
      const block = await web3.eth.getBlock(tx.receipt.blockNumber);
      const expectClaim = provideAmount
        .mul(utils.toBN(block.timestamp).sub(this.start))
        .div(this.duration);
      expect(tokenUserEnd.sub(tokenUser)).to.be.bignumber.eq(expectClaim);
      expect(releasedUserEnd.sub(releasedUser)).to.be.bignumber.eq(expectClaim);
    });

    it('withdraw COMBO 80%', async function() {
      const increaseDay = (this.durationDay * 80) / 100;
      await increase(duration.days(increaseDay.toString()));
      const tx = await this.rCombo.withdraw({ from: user });

      const tokenUserEnd = await this.token.balanceOf.call(user);
      const releasedUserEnd = await this.rCombo.released.call(user);
      const block = await web3.eth.getBlock(tx.receipt.blockNumber);
      const expectClaim = provideAmount
        .mul(utils.toBN(block.timestamp).sub(this.start))
        .div(this.duration);
      expect(tokenUserEnd.sub(tokenUser)).to.be.bignumber.eq(expectClaim);
      expect(releasedUserEnd.sub(releasedUser)).to.be.bignumber.eq(expectClaim);
    });

    it('withdraw COMBO 100%', async function() {
      const increaseDay = 361;
      await increase(duration.days(increaseDay.toString()));
      const tx = await this.rCombo.withdraw({ from: user });

      const tokenUserEnd = await this.token.balanceOf.call(user);
      const releasedUserEnd = await this.rCombo.released.call(user);
      const block = await web3.eth.getBlock(tx.receipt.blockNumber);
      const expectClaim = providedUser;
      expect(tokenUserEnd.sub(tokenUser)).to.be.bignumber.eq(expectClaim);
      expect(releasedUserEnd.sub(releasedUser)).to.be.bignumber.eq(expectClaim);
    });

    it('withdraw COMBO for user 20%', async function() {
      const increaseDay = (this.durationDay * 20) / 100;
      await increase(duration.days(increaseDay.toString()));
      const tx = await this.rCombo.withdrawFor(user, { from: _ });

      const tokenUserEnd = await this.token.balanceOf.call(user);
      const releasedUserEnd = await this.rCombo.released.call(user);
      const block = await web3.eth.getBlock(tx.receipt.blockNumber);
      const expectClaim = provideAmount
        .mul(utils.toBN(block.timestamp).sub(this.start))
        .div(this.duration);
      expect(tokenUserEnd.sub(tokenUser)).to.be.bignumber.eq(expectClaim);
      expect(releasedUserEnd.sub(releasedUser)).to.be.bignumber.eq(expectClaim);
    });

    it('withdraw COMBO for user 40%', async function() {
      const increaseDay = (this.durationDay * 40) / 100;
      await increase(duration.days(increaseDay.toString()));
      const tx = await this.rCombo.withdrawFor(user, { from: _ });

      const tokenUserEnd = await this.token.balanceOf.call(user);
      const releasedUserEnd = await this.rCombo.released.call(user);
      const block = await web3.eth.getBlock(tx.receipt.blockNumber);
      const expectClaim = provideAmount
        .mul(utils.toBN(block.timestamp).sub(this.start))
        .div(this.duration);
      expect(tokenUserEnd.sub(tokenUser)).to.be.bignumber.eq(expectClaim);
      expect(releasedUserEnd.sub(releasedUser)).to.be.bignumber.eq(expectClaim);
    });

    it('withdraw COMBO for user 60%', async function() {
      const increaseDay = (this.durationDay * 60) / 100;
      await increase(duration.days(increaseDay.toString()));
      const tx = await this.rCombo.withdrawFor(user, { from: _ });

      const tokenUserEnd = await this.token.balanceOf.call(user);
      const releasedUserEnd = await this.rCombo.released.call(user);
      const block = await web3.eth.getBlock(tx.receipt.blockNumber);
      const expectClaim = provideAmount
        .mul(utils.toBN(block.timestamp).sub(this.start))
        .div(this.duration);
      expect(tokenUserEnd.sub(tokenUser)).to.be.bignumber.eq(expectClaim);
      expect(releasedUserEnd.sub(releasedUser)).to.be.bignumber.eq(expectClaim);
    });

    it('withdraw COMBO for user 80%', async function() {
      const increaseDay = (this.durationDay * 80) / 100;
      await increase(duration.days(increaseDay.toString()));
      const tx = await this.rCombo.withdrawFor(user, { from: _ });

      const tokenUserEnd = await this.token.balanceOf.call(user);
      const releasedUserEnd = await this.rCombo.released.call(user);
      const block = await web3.eth.getBlock(tx.receipt.blockNumber);
      const expectClaim = provideAmount
        .mul(utils.toBN(block.timestamp).sub(this.start))
        .div(this.duration);
      expect(tokenUserEnd.sub(tokenUser)).to.be.bignumber.eq(expectClaim);
      expect(releasedUserEnd.sub(releasedUser)).to.be.bignumber.eq(expectClaim);
    });

    it('withdraw COMBO for user 100%', async function() {
      const increaseDay = 361;
      await increase(duration.days(increaseDay.toString()));
      const tx = await this.rCombo.withdrawFor(user, { from: _ });

      const tokenUserEnd = await this.token.balanceOf.call(user);
      const releasedUserEnd = await this.rCombo.released.call(user);
      const block = await web3.eth.getBlock(tx.receipt.blockNumber);
      const expectClaim = providedUser;
      expect(tokenUserEnd.sub(tokenUser)).to.be.bignumber.eq(expectClaim);
      expect(releasedUserEnd.sub(releasedUser)).to.be.bignumber.eq(expectClaim);
    });

    it('withdraw COMBO after providing RCOMBO twice', async function() {
      // provide again
      await this.rCombo.provideFor(user, provideAmount, { from: _ });

      // withdraw
      tokenUser = await this.token.balanceOf.call(user);
      releasedUser = await this.rCombo.released.call(user);
      const increaseDay = (this.durationDay * 20) / 100;
      await increase(duration.days(increaseDay.toString()));
      const tx = await this.rCombo.withdraw({ from: user });

      // verification
      const tokenUserEnd = await this.token.balanceOf.call(user);
      const releasedUserEnd = await this.rCombo.released.call(user);
      const block = await web3.eth.getBlock(tx.receipt.blockNumber);
      const totalProvidedAmount = provideAmount.add(provideAmount);
      const expectClaim = totalProvidedAmount
        .mul(utils.toBN(block.timestamp).sub(this.start))
        .div(this.duration);
      expect(tokenUserEnd.sub(tokenUser)).to.be.bignumber.eq(expectClaim);
      expect(releasedUserEnd.sub(releasedUser)).to.be.bignumber.eq(expectClaim);
    });

    it('provide RCOMBO in the between withdraw twice case', async function() {
      // withdraw
      const increaseDay1 = (this.durationDay * 20) / 100;
      await increase(duration.days(increaseDay1.toString()));
      await this.rCombo.withdrawFor(user, { from: _ });

      // provide
      await this.rCombo.provideFor(user, provideAmount, { from: _ });

      // withdraw again
      const increaseDay2 = (this.durationDay * 40) / 100;
      await increase(duration.days(increaseDay2.toString()));
      const tx = await this.rCombo.withdraw({ from: user });

      // verification
      const tokenUserEnd = await this.token.balanceOf.call(user);
      const releasedUserEnd = await this.rCombo.released.call(user);
      const block = await web3.eth.getBlock(tx.receipt.blockNumber);
      const totalProvidedAmount = provideAmount.add(provideAmount);
      const expectClaim = totalProvidedAmount
        .mul(utils.toBN(block.timestamp).sub(this.start))
        .div(this.duration);
      expect(tokenUserEnd.sub(tokenUser)).to.be.bignumber.eq(expectClaim);
      expect(releasedUserEnd.sub(releasedUser)).to.be.bignumber.eq(expectClaim);
    });

    it('withdraw COMBO for user after providing RCOMBO twice', async function() {
      // provide
      await this.rCombo.provideFor(user, provideAmount, { from: _ });

      // withdraw
      tokenUser = await this.token.balanceOf.call(user);
      releasedUser = await this.rCombo.released.call(user);
      const increaseDay = (this.durationDay * 20) / 100;
      await increase(duration.days(increaseDay.toString()));
      const tx = await this.rCombo.withdrawFor(user, { from: _ });

      // verification
      const tokenUserEnd = await this.token.balanceOf.call(user);
      const releasedUserEnd = await this.rCombo.released.call(user);
      const block = await web3.eth.getBlock(tx.receipt.blockNumber);
      const totalProvidedAmount = provideAmount.add(provideAmount);
      const expectClaim = totalProvidedAmount
        .mul(utils.toBN(block.timestamp).sub(this.start))
        .div(this.duration);
      expect(tokenUserEnd.sub(tokenUser)).to.be.bignumber.eq(expectClaim);
      expect(releasedUserEnd.sub(releasedUser)).to.be.bignumber.eq(expectClaim);
    });

    it('Provide RCOMBO for user in the between withdraw twice case', async function() {
      // withdraw
      const increaseDay1 = (this.durationDay * 20) / 100;
      await increase(duration.days(increaseDay1.toString()));
      await this.rCombo.withdraw({ from: user });

      // provide
      await this.rCombo.provideFor(user, provideAmount, { from: _ });

      // withdraw again
      const increaseDay2 = (this.durationDay * 40) / 100;
      await increase(duration.days(increaseDay2.toString()));
      const tx = await this.rCombo.withdrawFor(user, { from: _ });

      // verification
      const tokenUserEnd = await this.token.balanceOf.call(user);
      const releasedUserEnd = await this.rCombo.released.call(user);
      const block = await web3.eth.getBlock(tx.receipt.blockNumber);
      const totalProvidedAmount = provideAmount.add(provideAmount);
      const expectClaim = totalProvidedAmount
        .mul(utils.toBN(block.timestamp).sub(this.start))
        .div(this.duration);
      expect(tokenUserEnd.sub(tokenUser)).to.be.bignumber.eq(expectClaim);
      expect(releasedUserEnd.sub(releasedUser)).to.be.bignumber.eq(expectClaim);
    });

    it('Should revert: withdraw RCOMBO user who will not provided before', async function() {
      await expectRevert(
        this.rCombo.withdraw({ from: someone }),
        'GTS: You are have not unlocked tokens yet'
      );
    });

    it('Should revert: withdraw RCOMBO for user who will not provided before', async function() {
      await expectRevert(
        this.rCombo.withdrawFor(someone, { from: _ }),
        'GTS: You are have not unlocked tokens yet'
      );
    });
  });
});
