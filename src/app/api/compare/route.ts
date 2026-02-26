import { NextResponse } from 'next/server';

// ✅ 关键修改：只保留命名导出
export async function POST(req: Request) {
  try {
    const { answers } = await req.json();

    if (!answers) {
      return NextResponse.json({ error: '缺少回答数据' }, { status: 400 });
    }

    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: '未配置通义千问 Key' }, { status: 500 });
    }

    const prompt = `
你是一个专业的 AI 模型评估专家。
我有三个 AI 模型（通义千问、DeepSeek、豆包）对同一个问题的回答。
请你阅读它们的回答，从以下几个维度进行客观、公正的对比分析：
1. **准确性**：事实是否准确，有无幻觉。
2. **逻辑性**：条理是否清晰，步骤是否合理。
3. **完整性**：是否覆盖了问题的所有方面。
4. **实用性**：给出的建议或代码是否可直接使用。

请严格按照以下 Markdown 表格格式输出你的分析结果（不要输出任何多余的解释文字，直接输出表格）：

| 维度 | 通义千问 | DeepSeek | 豆包 | 胜出者 |
| :--- | :--- | :--- | :--- | :--- |
| **准确性** | (简短评价) | (简短评价) | (简短评价) | (模型名) |
| **逻辑性** | (简短评价) | (简短评价) | (简短评价) | (模型名) |
| **完整性** | (简短评价) | (简短评价) | (简短评价) | (模型名) |
| **实用性** | (简短评价) | (简短评价) | (简短评价) | (模型名) |

**总结建议**：
(在这里写一段 100 字左右的总结，推荐哪个模型最适合回答此类问题，并说明理由)

---
以下是三个模型的回答内容：

【通义千问】：
${answers["通义千问"]}

【DeepSeek】：
${answers["DeepSeek"]}

【豆包】：
${answers["豆包"]}
`;

    const url = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'qwen-plus',
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const markdownTable = data.choices?.[0]?.message?.content || '分析失败';

    return NextResponse.json({ markdown: markdownTable });

  } catch (error: any) {
    console.error('Compare API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}