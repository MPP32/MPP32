import type { MPP32Config, IntelligenceResult, ServiceInfo } from './types.js';
export declare class MPP32 {
    private apiUrl;
    private tempoPrivateKey?;
    private solanaPrivateKey?;
    private preferredMethod;
    constructor(config?: MPP32Config);
    analyze(token: string): Promise<IntelligenceResult>;
    listServices(category?: string): Promise<ServiceInfo[]>;
    callService(slug: string, options?: {
        method?: string;
        body?: string;
        query?: Record<string, string>;
    }): Promise<unknown>;
    paidFetch(url: string, init?: RequestInit): Promise<Response>;
    private parsePaymentChallenges;
    private selectPaymentMethod;
    private completePayment;
    private completeTempoPayment;
    private completeX402Payment;
    private decodeSolanaPrivateKey;
}
