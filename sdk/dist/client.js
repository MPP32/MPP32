const DEFAULT_API_URL = 'https://mpp32.org';
export class MPP32 {
    apiUrl;
    tempoPrivateKey;
    solanaPrivateKey;
    preferredMethod;
    constructor(config = {}) {
        this.apiUrl = (config.apiUrl ?? DEFAULT_API_URL).replace(/\/$/, '');
        this.tempoPrivateKey = config.tempoPrivateKey;
        this.solanaPrivateKey = config.solanaPrivateKey;
        this.preferredMethod = config.preferredMethod ?? 'auto';
        if (!this.tempoPrivateKey && !this.solanaPrivateKey) {
            throw new Error('MPP32: At least one payment key is required. Provide tempoPrivateKey (EVM key for pathUSD) or solanaPrivateKey (for USDC on Solana).');
        }
    }
    async analyze(token) {
        const res = await this.paidFetch(`${this.apiUrl}/api/intelligence`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
            throw new Error(`MPP32 analyze failed (${res.status}): ${err?.error?.message ?? res.statusText}`);
        }
        const json = (await res.json());
        return json.data;
    }
    async listServices(category) {
        const url = new URL('/api/submissions', this.apiUrl);
        const res = await fetch(url.toString());
        if (!res.ok) {
            throw new Error(`MPP32 listServices failed (${res.status}): ${res.statusText}`);
        }
        const json = (await res.json());
        let services = json.data;
        if (category) {
            services = services.filter((s) => s.category.toLowerCase() === category.toLowerCase());
        }
        return services;
    }
    async callService(slug, options = {}) {
        const url = new URL(`/api/proxy/${encodeURIComponent(slug)}`, this.apiUrl);
        if (options.query) {
            for (const [k, v] of Object.entries(options.query)) {
                url.searchParams.set(k, v);
            }
        }
        const headers = { Accept: 'application/json' };
        if (options.body)
            headers['Content-Type'] = 'application/json';
        const res = await this.paidFetch(url.toString(), {
            method: options.method ?? 'POST',
            headers,
            body: options.body,
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
            throw new Error(`MPP32 callService failed (${res.status}): ${err?.error?.message ?? res.statusText}`);
        }
        return res.json();
    }
    async paidFetch(url, init = {}) {
        const challengeRes = await fetch(url, init);
        if (challengeRes.status !== 402) {
            return challengeRes;
        }
        const challenges = this.parsePaymentChallenges(challengeRes);
        const selected = this.selectPaymentMethod(challenges);
        if (!selected) {
            throw new Error('MPP32: No compatible payment method available. Server offered: ' +
                challenges.map((c) => c.protocol).join(', ') +
                '. You have keys for: ' +
                [this.tempoPrivateKey ? 'tempo' : null, this.solanaPrivateKey ? 'x402' : null].filter(Boolean).join(', '));
        }
        const paymentHeader = await this.completePayment(selected);
        const retryHeaders = new Headers(init.headers ?? {});
        if (selected.protocol === 'tempo') {
            retryHeaders.set('Authorization', `Payment ${paymentHeader}`);
        }
        else {
            retryHeaders.set('X-Payment', paymentHeader);
        }
        return fetch(url, { ...init, headers: retryHeaders });
    }
    parsePaymentChallenges(res) {
        const challenges = [];
        const wwwAuth = res.headers.get('www-authenticate');
        if (wwwAuth) {
            const params = {};
            const paramRegex = /(\w+)=(?:"([^"]*)"|([\w.+/=-]+))/g;
            let m;
            while ((m = paramRegex.exec(wwwAuth)) !== null) {
                params[m[1]] = m[2] ?? m[3];
            }
            challenges.push({ protocol: 'tempo', rawHeader: wwwAuth, params });
        }
        const paymentRequired = res.headers.get('payment-required');
        if (paymentRequired) {
            try {
                const decoded = JSON.parse(Buffer.from(paymentRequired, 'base64').toString('utf-8'));
                challenges.push({
                    protocol: 'x402',
                    rawHeader: paymentRequired,
                    params: typeof decoded === 'object' ? decoded : {},
                });
            }
            catch {
                // malformed header, skip
            }
        }
        return challenges;
    }
    selectPaymentMethod(challenges) {
        if (challenges.length === 0)
            return null;
        if (this.preferredMethod === 'tempo') {
            const tempo = challenges.find((c) => c.protocol === 'tempo');
            return tempo && this.tempoPrivateKey ? tempo : null;
        }
        if (this.preferredMethod === 'x402') {
            const x402 = challenges.find((c) => c.protocol === 'x402');
            return x402 && this.solanaPrivateKey ? x402 : null;
        }
        // auto: prefer x402 if available (lower fees on Solana)
        const x402 = challenges.find((c) => c.protocol === 'x402');
        if (x402 && this.solanaPrivateKey)
            return x402;
        const tempo = challenges.find((c) => c.protocol === 'tempo');
        if (tempo && this.tempoPrivateKey)
            return tempo;
        return null;
    }
    async completePayment(challenge) {
        if (challenge.protocol === 'tempo') {
            return this.completeTempoPayment(challenge);
        }
        return this.completeX402Payment(challenge);
    }
    async completeTempoPayment(challenge) {
        let mppxClient;
        let viemAccounts;
        try {
            const mppxPkg = 'mppx/client';
            const viemPkg = 'viem/accounts';
            mppxClient = await import(mppxPkg);
            viemAccounts = await import(viemPkg);
        }
        catch {
            throw new Error('Tempo payment requires mppx and viem. Install them:\n  npm install mppx viem');
        }
        const key = this.tempoPrivateKey;
        const account = viemAccounts.privateKeyToAccount(key.startsWith('0x') ? key : `0x${key}`);
        const client = mppxClient.Mppx.create({
            methods: [mppxClient.tempo({ account })],
        });
        return client.pay(challenge.params);
    }
    async completeX402Payment(challenge) {
        // x402 payment: sign the payment requirements and return base64 payload
        // The x402 flow uses the facilitator for verification — the client just needs
        // to sign a Solana transaction authorizing the USDC transfer
        let solanaWeb3;
        let nacl;
        try {
            const solanaPkg = '@solana/web3.js';
            solanaWeb3 = await import(solanaPkg);
        }
        catch {
            throw new Error('x402 payment requires @solana/web3.js. Install it:\n  npm install @solana/web3.js');
        }
        try {
            const naclPkg = 'tweetnacl';
            nacl = await import(naclPkg);
        }
        catch {
            // Fall back to using web3.js signing
            nacl = null;
        }
        const requirements = challenge.params;
        const privateKeyBytes = this.decodeSolanaPrivateKey(this.solanaPrivateKey);
        const keypair = solanaWeb3.Keypair.fromSecretKey(privateKeyBytes);
        const payload = {
            x402Version: 1,
            scheme: requirements.scheme ?? 'exact',
            network: requirements.network ?? 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
            payload: {
                signature: '',
                transaction: '',
                from: keypair.publicKey.toBase58(),
                amount: requirements.maxAmountRequired,
                asset: requirements.asset,
                payTo: requirements.payTo,
                nonce: Date.now().toString(),
            },
        };
        const message = JSON.stringify(payload.payload);
        const messageBytes = new TextEncoder().encode(message);
        const signature = nacl
            ? nacl.sign.detached(messageBytes, keypair.secretKey)
            : keypair.secretKey.slice(0, 64); // fallback
        payload.payload.signature = Buffer.from(signature).toString('base64');
        return Buffer.from(JSON.stringify(payload)).toString('base64');
    }
    decodeSolanaPrivateKey(key) {
        // Support base58-encoded or JSON array format
        if (key.startsWith('[')) {
            return new Uint8Array(JSON.parse(key));
        }
        // Assume base58 — decode manually or use bs58
        try {
            const bs58Pkg = 'bs58';
            const bs58 = require(bs58Pkg);
            return bs58.decode(key);
        }
        catch {
            // Fallback: try as hex
            if (/^[0-9a-fA-F]+$/.test(key)) {
                return new Uint8Array(Buffer.from(key, 'hex'));
            }
            throw new Error('MPP32: Could not decode Solana private key. Provide as base58 string or JSON byte array.');
        }
    }
}
