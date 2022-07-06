import Sequencer from '@jest/test-sequencer'

export default class CustomSequencer extends Sequencer.default {
  sort(tests) {
    const digitalkTests = [
        'Health.test.js',
        'Company.test.js',
        'Department.test.js',
        'Phase.test.js',
        //'Ticket.test.js',
        //'Phase_ticket.test.js'
    ]

    const testsInOrder = []
    const copyTests = Array.from(tests)

    for (let i = 0; i < digitalkTests.length; i++) {
      for (let j = 0; j < copyTests.length; j++) {
        const testSplit = copyTests[j].path.split('/')
        const testFile = testSplit[testSplit.length - 1]

        if (testFile === digitalkTests[i]) {
          testsInOrder.push(copyTests[j])
        }
      }
    }

    return testsInOrder
  }
}
