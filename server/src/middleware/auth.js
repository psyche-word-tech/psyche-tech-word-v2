/**
 * 认证中间件
 * 从 Authorization: Bearer <token> header 中解析用户 ID
 * token 格式: userId:timestamp 的 base64
 */
export function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('[Auth] Missing token, authHeader:', authHeader);
        return res.status(401).json({ error: 'Unauthorized: missing token' });
    }
    const token = authHeader.slice(7);
    console.log('[Auth] Token received:', token);
    try {
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        console.log('[Auth] Decoded token:', decoded);
        const [userIdStr] = decoded.split(':');
        const userId = parseInt(userIdStr, 10);
        console.log('[Auth] Parsed userId:', userId);
        if (!userId || isNaN(userId)) {
            return res.status(401).json({ error: 'Unauthorized: invalid token' });
        }
        req.userId = userId;
        next();
    }
    catch (err) {
        console.log('[Auth] Token decode error:', err);
        return res.status(401).json({ error: 'Unauthorized: invalid token' });
    }
}
/**
 * 可选认证中间件
 * 有 token 则解析 userId，没有也不报错
 */
export function optionalAuthMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
    }
    const token = authHeader.slice(7);
    try {
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        const [userIdStr] = decoded.split(':');
        const userId = parseInt(userIdStr, 10);
        if (userId && !isNaN(userId)) {
            req.userId = userId;
        }
    }
    catch {
        // ignore invalid token
    }
    next();
}
