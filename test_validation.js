const testCases = [
  { input: '10', max: 50, default: 20, expected: 10 },
  { input: '100', max: 50, default: 20, expected: 50 },
  { input: '0', max: 50, default: 20, expected: 1 },
  { input: '-5', max: 50, default: 20, expected: 1 },
  { input: 'abc', max: 50, default: 20, expected: 20 },
  { input: null, max: 50, default: 20, expected: 20 },
  { input: '', max: 50, default: 20, expected: 20 },
];

console.log('Testing limit validation logic:');
testCases.forEach((test, index) => {
  let result;
  if (test.input === null || test.input === '') {
    result = test.default;
  } else {
    const parsed = parseInt(test.input, 10);
    if (isNaN(parsed)) {
      result = test.default;
    } else if (parsed < 1) {
      result = 1;
    } else if (parsed > test.max) {
      result = test.max;
    } else {
      result = parsed;
    }
  }
  
  const pass = result === test.expected ? 'PASS' : 'FAIL';
  console.log(pass + ' Test ' + (index + 1) + ': input="' + test.input + '" -> ' + result + ' (expected ' + test.expected + ')');
});
