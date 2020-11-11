import {RippleAPI} from "ripple-lib";

export class RippleGateway {
	public static async getApi(offline, server): Promise<RippleAPI> {
		if (offline) {
			return new RippleAPI({});
		} else {
			const api = new RippleAPI({server: server});
			await api.connect();
			return api;
		}
	}
}
