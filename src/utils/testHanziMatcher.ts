import { HanziMatcher } from './HanziMatcher';

// 测试汉字匹配器
async function testHanziMatcher() {
  console.log('开始测试汉字匹配器...');

  const matcher = HanziMatcher.getInstance();

  // 测试数据：模拟用户手写的"人"字
  const testStrokes = [
    {
      points: [
        { x: 50, y: 20 },
        { x: 50, y: 80 }
      ]
    },
    {
      points: [
        { x: 20, y: 50 },
        { x: 80, y: 50 }
      ]
    }
  ];

  // 测试宽松模式
  console.log('测试宽松模式匹配 "人"...');
  matcher.setStrictMode(false);
  const looseResult = await matcher.matchCharacter('人', testStrokes);
  console.log('宽松模式结果:', looseResult);

  // 测试严格模式
  console.log('测试严格模式匹配 "人"...');
  matcher.setStrictMode(true);
  const strictResult = await matcher.matchCharacter('人', testStrokes);
  console.log('严格模式结果:', strictResult);

  // 测试不同笔画数
  console.log('测试笔画数验证...');
  const singleStroke = [{
    points: [
      { x: 10, y: 10 },
      { x: 90, y: 90 }
    ]
  }];

  const singleResult = await matcher.matchCharacter('一', singleStroke);
  console.log('单笔匹配 "一":', singleResult);

  // 测试无效笔画
  console.log('测试无效笔画...');
  const invalidStrokes = [{
    points: [
      { x: 10, y: 10 }
    ] // 只有一个点，无效
  }];

  const invalidResult = await matcher.matchCharacter('人', invalidStrokes);
  console.log('无效笔画结果:', invalidResult);

  console.log('测试完成！');

  // 清理资源
  matcher.cleanup();
}

// 运行测试
if (typeof window !== 'undefined') {
  // 在浏览器环境中运行
  (window as any).testHanziMatcher = testHanziMatcher;
  console.log('测试函数已挂载到 window.testHanziMatcher，在控制台中调用进行测试');
} else {
  // 在Node.js环境中直接运行
  testHanziMatcher().catch(console.error);
}