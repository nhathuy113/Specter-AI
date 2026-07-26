export interface LeetCodeFixture {
  slug: string
  title: string
  description: string
  signature: string
  testHarness: string
}

/** LeetCode #4 — used for Cursor SDK code-gen smoke tests. */
export const MEDIAN_OF_TWO_SORTED_ARRAYS: LeetCodeFixture = {
  slug: 'median-of-two-sorted-arrays',
  title: '4. Median of Two Sorted Arrays',
  description: `Given two sorted arrays nums1 and nums2 of size m and n respectively, return the median of the two sorted arrays.
The overall run time complexity must be O(log (m+n)).`,
  signature: 'function findMedianSortedArrays(nums1, nums2)',
  testHarness: `const { findMedianSortedArrays } = require('./solution.js');

function assertMedian(nums1, nums2, expected) {
  const got = findMedianSortedArrays(nums1, nums2);
  if (Math.abs(got - expected) > 1e-5) {
    throw new Error(
      'findMedianSortedArrays(' + JSON.stringify(nums1) + ', ' + JSON.stringify(nums2) + ') = ' + got + ', expected ' + expected
    );
  }
}

assertMedian([1, 3], [2], 2.0);
assertMedian([1, 2], [3, 4], 2.5);
assertMedian([0, 0], [0, 0], 0.0);
assertMedian([], [1], 1.0);
assertMedian([2], [], 2.0);

console.log('ALL_TESTS_PASSED');
`
}
