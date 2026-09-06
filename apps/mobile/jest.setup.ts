// Jest setup for Expo SDK 57: worklets and reanimated mocks, in-memory AsyncStorage.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'))

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('react-native-reanimated').setUpTests()

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)
