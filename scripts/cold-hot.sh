#!/usr/bin/env bash

set -e

if [ -z $CURRENCY ]; then
	echo "CURRENCY not set"
	exit 1
fi

if [ -z $FUNDING_SEQUENCE ]; then
	echo "FUNDING_SEQUENCE not set"
	exit 1
fi

if [ -z $FUNDING_SECRET ]; then
	echo "FUNDING_SECRET not set"
	exit 1
fi

if [ -z $FUNDING_ADDRESS ]; then
	echo "FUNDING_ADDRESS not set"
	exit 1
fi

echo "-> Generating wallets"
echo -n "* cold wallet: "
ripple-tools generate --format json --offline > cold_wallet.json
COLD_ADDRESS=$(cat cold_wallet.json | jq -r '.address')
COLD_SECRET=$(cat cold_wallet.json | jq -r '.secret')
echo ${COLD_ADDRESS}

echo -n "* hot wallet: "
ripple-tools generate --format json --offline > hot_wallet.json
HOT_ADDRESS=$(cat hot_wallet.json | jq -r '.address')
HOT_SECRET=$(cat hot_wallet.json | jq -r '.secret')
echo ${HOT_ADDRESS}

echo "* funding sequence: $FUNDING_SEQUENCE"

echo "-> generating transactions"
echo "* tx funding hot wallet"
ripple-tools send-payment \
	--amount 50 --to $COLD_ADDRESS \
	--fee 0.000012 --sequence $FUNDING_SEQUENCE  \
	--address $FUNDING_ADDRESS --secret $FUNDING_SECRET \
	--format json --offline --export > transactions.json

echo "* tx funding cold wallet"
ripple-tools send-payment \
	--amount 50 --to $HOT_ADDRESS \
	--fee 0.000012 --sequence $((FUNDING_SEQUENCE+1)) \
	--address $FUNDING_ADDRESS --secret $FUNDING_SECRET \
	--format json --offline --export >> transactions.json

echo "* tx setting flags on cold wallet"
ripple-tools set-flag defaultRipple \
	--address $COLD_ADDRESS --secret $COLD_SECRET \
	--fee 0.000012 --sequence 1 \
	--format json --offline --export >> transactions.json
ripple-tools set-flag requireDestinationTag \
	--address $COLD_ADDRESS --secret $COLD_SECRET \
	--fee 0.000012 --sequence 2 \
	--format json --offline --export >> transactions.json
ripple-tools set-flag disallowIncomingXRP \
	--address $COLD_ADDRESS --secret $COLD_SECRET \
	--fee 0.000012 --sequence 3 \
	--format json --offline --export >> transactions.json

echo "* tx hot -> cold trust line"

IFS=',' read -r -a currs <<< $CURRENCY
curr=""
SEQ=1

for curr in "${currs[@]}"
do
	echo "** [${curr}]: tx hot -> cold trust line -- seq ${SEQ}"
	ripple-tools set-trust \
		--address $HOT_ADDRESS --secret $HOT_SECRET \
		--counterparty $COLD_ADDRESS --currency $curr \
		--fee 0.000012 --sequence $SEQ \
		--format json --offline --export >> transactions.json
	SEQ=$((SEQ + 1))
done

echo "-> done"

COLD_WALLET_REPO="wallets/cold_wallet_${CURRENCY}.json"
HOT_WALLET_REPO="wallets/hot_wallet_${CURRENCY}.json"

cp cold_wallet.json $COLD_WALLET_REPO
cp hot_wallet.json $HOT_WALLET_REPO
