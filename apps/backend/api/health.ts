// Endpoint de diagnóstico mínimo — não usa NestJS
export default function handler(req: any, res: any) {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      hasDatabase: !!process.env.DATABASE_URL,
      hasJwt: !!process.env.JWT_SECRET,
      nodeVersion: process.version,
    },
  });
}
