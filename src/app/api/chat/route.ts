// src/app/api/chat/route.ts
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  // 临时测试：不调用任何 AI，直接返回固定回复
  return Response.json({
    role: 'assistant',
    content: '✅ 后端函数正常！API Key 或网络可能有问题。'
  });
}