# Ripple tools

Ripple utilities for managing wallets

**Work in progress**

## Install

npm install -g ripple-tools

## Usage

```bash
$ ripple-tools --help

Usage: bin/ripple-tools <command> [options]

Commands:
  generate         Generate wallet
  set-flag <flag>  Set wallet flag
  set-fee <fee>    Set wallet fee
  set-trust        Set trustline
  get-info         Gets account info
  get-balances     Gets account balances
  send-payment     Sends payment
  submit [tx]      Submit raw transactions to ripple

Options:
  --address    wallet address                                           [string]
  --secret     wallet secret                                            [string]
  --format     output format[string] [choices: "yaml", "json"] [default: "yaml"]
  --verbose    be verbose                                              [boolean]
  --export     export transaction                                      [boolean]
  --sequence   wallet sequence                                          [number]
  --fee        set transaction fee                                      [string]
  --offline    start ripple api in offline mode                        [boolean]
  -h, --help   Show help                                               [boolean]
```
## Author

GateHub

## License

MIT

## Example use

#### Install

```bash
npm i # compiles code
npm link # links ripple-tools to executables
```

#### Use

```bash
npm run car get-info -- param1=value1 param2=value2 # running code with nodejs


# offline generate transactions to issue new currency
FUNDING_SECRET=<funding_secret> FUNDING_ADDRESS=<funding_address> \
FUNDING_SEQUENCE=<funding_sequence> CURRENCY=<currency_code> \
DOMAIN=<domain_name> FEE=<currency_fee> \
FUNDING_AMOUNT=<new_currency_amount> ./scripts/generateVaultOffline.sh


# submit generated transactions
ripple-tools submit-file --export=transactions.json --offline=false


# other examples
CURRENCY=LTC SERVER=wss://s.altnet.rippletest.net:51233 ./scripts/fund.sh
ripple-tools set-domain --address=xxx --secret=xxx --sequence=2 --offline=false --fee=0.01 "LTC-GH-HOT"
ripple-tools set-fee --address=xxx --secret=xxx --sequence=5 --offline=false 1.002
ripple-tools set-domain --address=xxx --secret=xxx --sequence=2 --offline=false --fee=0.01 "LTC-GH-COLD"
```
