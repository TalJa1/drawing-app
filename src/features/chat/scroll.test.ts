import { isNearBottom } from './scroll'

it('isNearBottom true within 80 px', () => {
  expect(isNearBottom({ scrollTop: 420, scrollHeight: 1000, clientHeight: 500 })).toBe(true)
  expect(isNearBottom({ scrollTop: 419, scrollHeight: 1000, clientHeight: 500 })).toBe(false)
  expect(isNearBottom({ scrollTop: 480, scrollHeight: 1000, clientHeight: 500 }, 10)).toBe(false)
})
