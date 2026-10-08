// Cast the evaluated CASE result, not a constant in an unreachable branch.
// PostgreSQL can evaluate constant casts while planning, falsely rejecting
// valid redemptions if the failure sentinel itself is cast inside ELSE.
export const promotionRedemptionGuardSql = "SELECT CAST(CASE WHEN EXISTS (SELECT 1 FROM crm_ecommerce_promotion_redemptions WHERE owner_id=? AND order_id=? AND promotion_id=?) THEN '1' ELSE 'PROMOTION_LIMIT_REACHED' END AS INTEGER)";
