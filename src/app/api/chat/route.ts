import { NextResponse } from 'next/server';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, model } = body;

    // 调试日志（部署后可删除）
    console.log('[API] 收到请求:', { model, messageCount: messages?.length });

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages 必须是非空数组' }, { status: 400 });
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'user') {
      return NextResponse.json({ error: '最后一条消息必须是用户提问' }, { status: 400 });
    }

    let apiKey = '';
    let url = '';
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };
    let payload: any = {};

    // --- 通义千问 ---
    if (model === '通义千问') {
      apiKey = process.env.DASHSCOPE_API_KEY!;
      if (!apiKey) throw new Error('未配置 DASHSCOPE_API_KEY');
      url = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
      payload = { model: 'qwen-plus', messages, stream: false };
      headers.Authorization = `Bearer ${apiKey}`;
    }
    // --- DeepSeek ---
    else if (model === 'DeepSeek') {
      apiKey = process.env.DEEPSEEK_API_KEY!;
      if (!apiKey) throw new Error('未配置 DEEPSEEK_API_KEY');
      url = 'https://api.deepseek.com/chat/completions';
      payload = { model: 'deepseek-chat', messages, stream: false };
      headers.Authorization = `Bearer ${apiKey}`;
    }
    // --- 豆包 ---
    else if (model === '豆包') {
      apiKey = process.env.VOLCENGINE_API_KEY;
      if (!apiKey) throw new Error('未配置 VOLCENGINE_API_KEY');
      url = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
      payload = { model: 'doubao-seed-2-0-pro-260215', messages, stream: false };
      headers.Authorization = `Bearer ${apiKey}`;
    }
    else {
      return NextResponse.json({
        reply: `【${model}】暂未接入。当前支持：通义千问、DeepSeek、豆包。`
      });
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[${model}] 请求失败:`, response.status, text);
      throw new Error(`API 错误 (${response.status})`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || '未返回有效内容';

    return NextResponse.json({ reply });

  } catch (error: any) {
    console.error('[API 全局错误]', error);
    return NextResponse.json({ error: error.message || '服务器内部错误' }, { status: 500 });
  }
}