import BigNumber from '@waves/bignumber';
import { Asset, Money } from '@waves/data-entities';
import { AssetBalance } from 'ui/reducers/updateState';
import { DEFAULT_FEE_CONFIG } from '../constants';
import { assetIds, assetLogosByNetwork } from './constants';

export function convertToSponsoredAssetFee(
  wavesFeeCoins: BigNumber,
  asset: Asset,
  assetBalance: AssetBalance
) {
  return new Money(
    new BigNumber(assetBalance.minSponsoredAssetFee)
      .mul(wavesFeeCoins)
      .div(DEFAULT_FEE_CONFIG.calculate_fee_rules.default.fee),
    asset
  );
}

export function getAssetLogo(network: string, assetId: string) {
  return assetLogosByNetwork[network]?.[assetId];
}

export function getAssetIdByName(network: string, assetName: string) {
  return assetIds[network]?.[assetName];
}
