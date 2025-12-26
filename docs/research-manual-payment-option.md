# Research: Manual Payment Option (BSB/Account Number)

## Summary

Based on research into invoicing best practices and SaaS platforms, **offering manual bank transfer payment options (BSB/account number) is a common and recommended practice**, with some important considerations.

## Key Findings

### 1. Industry Standard Practice

- **Common in invoicing software**: Most professional invoicing platforms (Stripe Invoicing, Xero, QuickBooks) offer bank transfer as a payment option
- **Customer preference**: Many customers, especially B2B, prefer bank transfers for larger payments
- **Regional requirements**: In Australia, providing BSB and account number is standard practice for invoices

### 2. Benefits

- **Lower transaction fees**: Bank transfers typically have lower or no fees compared to credit card processing
- **Higher payment acceptance**: Some customers cannot or prefer not to pay via credit card
- **Professional appearance**: Shows you accept multiple payment methods
- **Flexibility**: Gives customers choice in how they pay

### 3. Considerations

- **Manual tracking required**: Payments won't be automatically tracked
- **Admin overhead**: Requires manual status updates when payments are received
- **No automatic reconciliation**: Can't automatically match payments to invoices
- **Risk of errors**: Manual entry increases risk of incorrect payment status updates

### 4. Best Practices

1. **Clear labeling**: Clearly indicate that bank transfers require manual payment status updates
2. **Prominent notice**: Show a notice/warning that these payments won't be automatically tracked
3. **Reference numbers**: Include invoice numbers in payment instructions to help match payments
4. **Easy manual update**: Provide admin interface to easily update payment status
5. **Payment instructions**: Provide clear BSB and account number on invoice with instructions

## Recommendation

**Yes, offer manual bank transfer option with these requirements:**

1. ✅ Allow adding BSB and account number to invoices in settings
2. ✅ Display clear notice that manual payments require manual status updates
3. ✅ Provide admin interface to manually update invoice payment status
4. ✅ Include invoice number in payment reference instructions
5. ✅ Optionally show both payment methods (automatic + manual) with clear distinction

## Implementation Considerations

### Settings Location

- **Option 1**: Invoice Settings page (dedicated invoicing configuration)
- **Option 2**: Payment Providers settings tab (grouped with Stripe)
- **Recommendation**: Invoice Settings page, as it affects invoice display

### UI Requirements

1. **Settings toggle**: "Show bank transfer details on invoices"
2. **Input fields**: BSB and Account Number (with validation)
3. **Warning message**: Explain that manual payments require manual status updates
4. **Invoice display**: Show BSB/Account with clear payment instructions

### Manual Payment Status Update

- Add "Mark as Paid" action to invoice detail/view page
- Require confirmation dialog
- Update invoice status to "paid"
- Set `paid_at` timestamp
- Log who marked it as paid and when

### Payment Instructions on Invoice

```
Payment via Bank Transfer:
BSB: 123-456
Account Number: 987654321
Reference: [Invoice Number]

Note: Payments via bank transfer will not be automatically tracked.
Please include the invoice number in your transfer reference.
```

## References

- Stripe Invoicing: Offers bank transfer as payment option
- Industry standards: Most invoicing platforms support bank transfers
- Australian business practices: BSB/account number is standard for invoices
- Customer preference: Many prefer bank transfers for B2B payments
