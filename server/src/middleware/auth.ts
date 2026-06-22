import type { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  userId?: number;
}

/**
 * 认证中间件
 * 从 Authorization: Bearer <token> header 中解析用户 ID
 * token 格式: userId:timestamp 的 base64
 */
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: missing token' });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [userIdStr] = decoded.split(':');
    const userId = parseInt(userIdStr, 10);

    if (!userId || isNaN(userId)) {
      return res.status(401).json({ error: 'Unauthorized: invalid token' });
    }

    req.userId = userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized: invalid token' });
  }
}

/**
 * 可选认证中间件
 * 有 token 则解析 userId，没有也不报错
 */
export function optionalAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
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
  } catch {
    // ignore invalid token
  }

  next();
}
