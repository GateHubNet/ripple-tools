import * as YAML from "yamljs";
import * as fs from "fs";

let config = {
	format: "json",
	filename: undefined
};

export function setUilsConfig(conf) {
	config = conf;
}

export function printKV(data) {

	let text;

	switch(config.format) {
		case 'yaml':
			text = YAML.stringify(data, 2);
			break;
		default:
			text = JSON.stringify(data);
	}

	if (config.filename === undefined) {
		console.log(text);
		return;
	}

	fs.appendFileSync(config.filename, text + "\n");
}

export function assert(value, message) {
	if (!value) {
		console.error(message);
		process.exit(1);
	}
}

export async function processTransaction(ripple, argv, tx) {

	if (argv._[0] != "submit-file")
		assert(argv.secret, "secret must be set");

	const signature = await ripple.sign(tx.txJSON, argv.secret);
	tx.id = signature.id; // hash
	tx.signedTransaction = signature.signedTransaction;
	delete tx.instructions.maxLedgerVersion;

	// console.log(tx);

	if (argv.export) {
      printKV(tx);
      return;
    }

	try {
		await submit(ripple, tx)
	} catch (e) {
		console.error(e);
		process.exit(1);
	}
}

export async function submit(ripple, tx) {

	let version, result;

	console.log("submitting transaction");
	while (true) {
		try {
			version = await ripple.getLedgerVersion();
			result = await ripple.submit(tx.signedTransaction);
			break;
		} catch (err) {

			if (err.name === 'RippledError') {
				console.error("Error, resubmit", err);
				Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,1000)
				continue;
			}

			throw err;
		}
	}

	console.log("transaction submitted");

	if (result.resultCode !== 'tesSUCCESS' &&
		result.resultCode !== 'terQUEUED')
			throw new Error('problem submitting transaction: ' + result.resultCode);

	console.log("waiting to write tx to ledger..");
	while (true) {
		try {
			const submittedTx = await ripple.getTransaction(tx.id, {
				minLedgerVersion: version,
				maxLedgerVersion: version + 10
			});

			if (submittedTx.outcome.result !== "tesSUCCESS")
				throw new Error('problem submitting transaction');

			break;
		} catch (err) {

			if (err instanceof ripple.errors.MissingLedgerHistoryError ||
				err instanceof ripple.errors.PendingLedgerVersionError) {
				Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,1000);
				continue;
			}

			if (err instanceof ripple.errors.NotFoundError)
				throw new Error('problem processing transaction' + err);

			console.log(err);
			throw new Error('connection error');
		}
	}

	console.error(`transaction ${tx.id} written to ledger`);
}

