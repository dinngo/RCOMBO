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

const { COMBO_TOKEN } = require('./utils/constants');

const IouCOMBO = artifacts.require('IouCOMBO');
const IToken = artifacts.require('IERC20');

contract('iouCOMBO', function([_, user, someone]) {
  before(async function() {
    this.combo = await IToken.at(COMBO_TOKEN);
    let totalSupply = 5000000; // 5M ether
    this.totalSupply = ether(totalSupply.toString());
    this.start = await latest();
    this.iouCombo = await IouCOMBO.new(totalSupply, this.start);
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('transfer rCombo', function() {
    it('normal', async function() {
      expect(await this.iouCombo.totalSupply()).to.be.bignumber.eq(
        this.totalSupply
      );
      expect(await this.iouCombo.decimals()).to.be.bignumber.eq(new BN('18'));
      expect(await this.iouCombo.symbol()).to.be.eq('rCOMBO');
      expect(await this.iouCombo.name()).to.be.eq('Furucombo IOU COMBO Token');
      expect(await this.iouCombo.balanceOf.call(_)).to.be.bignumber.eq(
        this.totalSupply
      );

      const mintAmount = ether('1000000'); // 1M
      await this.iouCombo.transfer(user, mintAmount, { from: _ });
      expect(await this.iouCombo.balanceOf.call(user)).to.be.bignumber.eq(
        mintAmount
      );
    });
  });
});
