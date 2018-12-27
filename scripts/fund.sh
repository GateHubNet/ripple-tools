#!/bin/sh

COLD_WALLET=$(cat cold_wallet.json | jq -r '.address')
COLD_SECRET=$(cat cold_wallet.json | jq -r '.secret')
HOT_WALLET=$(cat hot_wallet.json | jq -r '.address')

ripple-tools send-payment \
	--address $COLD_WALLET --secret $COLD_SECRET \
	--to $HOT_WALLET --amount 100000 --currency $CURRENCY
