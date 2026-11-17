const yes = (value?: string) => value === 'true';
export function appUrl() {
  return (process.env.BETTER_AUTH_URL || process.env.APP_URL || 'http://127.0.0.1:3000').replace(
    /\/$/,
    '',
  );
}
export function paymentProvider(): 'stripe' | 'test' {
  return process.env.PAYMENTS_PROVIDER === 'test' ? 'test' : 'stripe';
}
export function commercialConfig() {
  const provider = paymentProvider();
  const test = provider === 'test';
  if (test && (process.env.NODE_ENV === 'production' || !yes(process.env.ENABLE_TEST_PAYMENTS)))
    throw new Error('Local test payments are disabled.');
  const live =
    process.env.NODE_ENV === 'production' ||
    /^(?:sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY || '');
  const fixtureLegal = /fixture|unapproved|placeholder|local[- ]test|demo terms/i.test(
    [
      process.env.LEGAL_TERMS_VERSION,
      process.env.SELLER_LEGAL_NAME,
      process.env.SELLER_ADDRESS,
    ].join(' '),
  );
  const legalApproved =
    yes(process.env.LEGAL_APPROVED) &&
    !!process.env.LEGAL_TERMS_VERSION &&
    /^https?:\/\//.test(process.env.LEGAL_TERMS_URL || '') &&
    /^https?:\/\//.test(process.env.LEGAL_PRIVACY_URL || '') &&
    !!process.env.SELLER_LEGAL_NAME &&
    !!process.env.SELLER_ADDRESS &&
    (!live ||
      (!fixtureLegal &&
        /^https:\/\//.test(process.env.LEGAL_TERMS_URL || '') &&
        /^https:\/\//.test(process.env.LEGAL_PRIVACY_URL || '')));
  const taxMode = process.env.TAX_MODE || 'unconfigured';
  const taxApproved =
    yes(process.env.TAX_APPROVED) &&
    ['inclusive', 'exclusive', 'exempt'].includes(taxMode) &&
    !!process.env.TAX_LABEL &&
    (!live || !/fixture|unapproved|placeholder|local[- ]test/i.test(process.env.TAX_LABEL || ''));
  const providerReady =
    test ||
    !!(
      process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_WEBHOOK_SECRET &&
      (taxMode === 'exempt' || yes(process.env.STRIPE_AUTOMATIC_TAX))
    );
  const stripeTestMode =
    provider === 'stripe' && /^(?:sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY || '');
  return {
    provider,
    test,
    stripeTestMode,
    legalApproved,
    taxApproved,
    providerReady,
    ready: legalApproved && taxApproved && providerReady,
    termsUrl: process.env.LEGAL_TERMS_URL || '',
    termsVersion: process.env.LEGAL_TERMS_VERSION || '',
    taxMode,
    taxLabel: process.env.TAX_LABEL || 'Tax treatment awaiting approval',
    sellerName: process.env.SELLER_LEGAL_NAME || 'HKGpipi',
    sellerAddress: process.env.SELLER_ADDRESS || '',
    automaticTax: taxMode !== 'exempt' && yes(process.env.STRIPE_AUTOMATIC_TAX),
    amount: 500000,
    currency: 'gbp' as const,
  };
}
export function publicCommerceConfig() {
  const {
    ready,
    provider,
    test,
    stripeTestMode,
    legalApproved,
    taxApproved,
    providerReady,
    termsUrl,
    termsVersion,
    taxMode,
    taxLabel,
    amount,
    currency,
  } = commercialConfig();
  return {
    ready,
    provider,
    test,
    stripeTestMode,
    legalApproved,
    taxApproved,
    providerReady,
    termsUrl,
    termsVersion,
    taxMode,
    taxLabel,
    amount,
    currency,
  };
}
