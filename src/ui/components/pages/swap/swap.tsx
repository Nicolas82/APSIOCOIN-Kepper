import BigNumber from '@waves/bignumber';
import { Money, Asset } from '@waves/data-entities';
import { TRANSACTION_TYPE } from '@waves/waves-transactions/dist/transactions';
import { swappableAssetIds } from 'assets/constants';
import { convertToSponsoredAssetFee, getAssetIdByName } from 'assets/utils';
import * as React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { updateAssets } from 'ui/actions/assets';
import { resetSwapScreenInitialState } from 'ui/actions/localState';
import { Avatar } from 'ui/components/ui/avatar/Avatar';
import { PAGES } from 'ui/pageConfig';
import background, { AssetDetail } from 'ui/services/Background';
import { useAppSelector, useAppDispatch } from 'ui/store';
import { SwapForm } from './form';
import { SwapResult } from './result';
import * as styles from './swap.module.css';

interface Props {
  setTab: (newTab: string) => void;
}

export function Swap({ setTab }: Props) {
  const { t } = useTranslation();

  const dispatch = useAppDispatch();
  const selectedAccount = useAppSelector(state => state.selectedAccount);
  const currentNetwork = useAppSelector(state => state.currentNetwork);

  const initialStateFromRedux = useAppSelector(
    state => state.localState.swapScreenInitialState
  );

  const [initialState] = React.useState(initialStateFromRedux);

  React.useEffect(() => {
    dispatch(resetSwapScreenInitialState());
  }, []);

  const initialFromAssetId =
    initialState.fromAssetId || getAssetIdByName(currentNetwork, 'WAVES');

  const initialToAssetId = getAssetIdByName(currentNetwork, 'USD');

  const [isSwapInProgress, setIsSwapInProgress] = React.useState(false);
  const [swapErrorMessage, setSwapErrorMessage] = React.useState<string | null>(
    null
  );
  const [wavesFeeCoins, setWavesFeeCoins] = React.useState<number | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    let timeout: number;

    Promise.all([
      background.getMinimumFee(TRANSACTION_TYPE.INVOKE_SCRIPT),
      background.getExtraFee(selectedAccount.address, currentNetwork),
    ]).then(([feeMinimum, feeExtra]) => {
      if (!cancelled) {
        setWavesFeeCoins(feeMinimum + feeExtra);
      }
    });

    return () => {
      cancelled = true;

      if (timeout) {
        window.clearTimeout(timeout);
      }
    };
  }, [currentNetwork, selectedAccount.address]);

  const assets = useAppSelector(state => state.assets);

  const swappableAssetEntries = React.useMemo(
    () =>
      swappableAssetIds[currentNetwork as 'mainnet' | 'testnet'].map(
        (assetId): [string, AssetDetail | undefined] => [
          assetId,
          assets[assetId],
        ]
      ),
    [assets, currentNetwork]
  );

  React.useEffect(() => {
    const assetsToUpdate = Array.from(
      new Set(
        swappableAssetEntries
          .filter(([_assetId, asset]) => asset == null)
          .map(([assetId]) => assetId)
      )
    );

    if (assetsToUpdate.length !== 0) {
      dispatch(updateAssets(assetsToUpdate));
    }
  }, [swappableAssetEntries]);

  const accountBalance = useAppSelector(
    state => state.balances[state.selectedAccount.address]
  );

  const [performedSwapData, setPerformedSwapData] = React.useState<{
    fromMoney: Money;
    transactionId: string;
  } | null>(null);

  const swappableAssets = swappableAssetEntries.map(
    ([_assetId, asset]) => asset
  );

  return (
    <div className={styles.root}>
      <div className={styles.wrapper}>
        <header className={styles.header}>
          <h1 className={styles.title}>
            <Trans i18nKey="swap.title" />
          </h1>
        </header>

        {wavesFeeCoins == null ||
        !accountBalance.assets ||
        swappableAssets.some(asset => asset == null) ? (
          <div className={styles.loader} />
        ) : (
          <div className={styles.content}>
            <div className={styles.accountInfoHeader}>
              <Avatar address={selectedAccount.address} size={28} />
              <div className={styles.accountName}>{selectedAccount.name}</div>
            </div>

            {performedSwapData == null ? (
              <SwapForm
                initialFromAssetId={initialFromAssetId}
                initialToAssetId={initialToAssetId}
                isSwapInProgress={isSwapInProgress}
                swapErrorMessage={swapErrorMessage}
                swappableAssets={swappableAssets}
                wavesFeeCoins={wavesFeeCoins}
                onSwap={async ({
                  feeAssetId,
                  fromAssetId,
                  fromCoins,
                  minReceivedCoins,
                  toAssetId,
                  toCoins,
                }) => {
                  setSwapErrorMessage(null);
                  setIsSwapInProgress(true);

                  try {
                    const result = await background.performSwap({
                      fee: convertToSponsoredAssetFee(
                        new BigNumber(wavesFeeCoins),
                        new Asset(assets[feeAssetId]),
                        accountBalance.assets[feeAssetId]
                      ).toCoins(),
                      feeAssetId,
                      fromAssetId,
                      fromCoins,
                      minReceivedCoins,
                      toAssetId,
                      toCoins,
                    });

                    setPerformedSwapData({
                      fromMoney: new Money(
                        new BigNumber(fromCoins),
                        new Asset(assets[fromAssetId])
                      ),
                      transactionId: result.transactionId,
                    });
                  } catch (err) {
                    const errMessage = err?.message;

                    if (typeof errMessage === 'string') {
                      const match = errMessage.match(
                        /error\s+while\s+executing\s+account-script:\s*\w+\(code\s*=\s*(?:.+),\s*error\s*=\s*([\s\S]+)\s*,\s*log\s*=/im
                      );

                      if (match?.[1]) {
                        const msg = match[1];

                        setSwapErrorMessage(msg);
                        setIsSwapInProgress(false);
                        return;
                      }
                    }

                    setSwapErrorMessage(err.message || t('swap.failMessage'));
                    setIsSwapInProgress(false);
                  }
                }}
              />
            ) : (
              <SwapResult
                fromMoney={performedSwapData.fromMoney}
                transactionId={performedSwapData.transactionId}
                onClose={() => {
                  setTab(PAGES.ROOT);
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
