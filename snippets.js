/* ===== Codeinsigh — snippets.js v2 ===== */
/* Playground Snippets: dropdown menu under header */
(() => {
  'use strict';

  // ── Snippet library ──
  const SNIPPETS = [
    {
      name: 'Maximum in Array',
      desc: 'Finds the largest number in an array using iteration.',
      code: `#include <stdio.h>

int find_max(int *arr, int size) {
    int max = arr[0];
    for (int i = 1; i < size; i++) {
        if (arr[i] > max) {
            max = arr[i];
        }
    }
    return max;
}

int main() {
    int numbers[] = {12, 45, 7, 23, 56, 89, 34};
    int length = sizeof(numbers) / sizeof(numbers[0]);
    int result = find_max(numbers, length);
    printf("Maximum value: %d\\n", result);
    return 0;
}`
    },
    {
      name: 'Binary Search',
      desc: 'Search a sorted array using divide-and-conquer.',
      code: `#include <stdio.h>

int binary_search(int arr[], int size, int target) {
    int low = 0;
    int high = size - 1;

    while (low <= high) {
        int mid = (low + high) / 2;

        if (arr[mid] == target) {
            return mid;
        } else if (arr[mid] < target) {
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    return -1;
}

int main() {
    int sorted[] = {2, 5, 8, 12, 16, 23, 38, 56, 72, 91};
    int length = sizeof(sorted) / sizeof(sorted[0]);
    int index = binary_search(sorted, length, 23);
    printf("Found at index: %d\\n", index);
    return 0;
}`
    },
    {
      name: 'Palindrome Check',
      desc: 'Checks whether a string reads the same forward and backward.',
      code: `#include <stdio.h>
#include <string.h>

int is_palindrome(char str[]) {
    int left = 0;
    int right = strlen(str) - 1;

    while (left < right) {
        if (str[left] != str[right]) {
            return 0;
        }
        left++;
        right--;
    }
    return 1;
}

int main() {
    char word[] = "racecar";
    if (is_palindrome(word)) {
        printf("%s is a palindrome\\n", word);
    } else {
        printf("%s is not a palindrome\\n", word);
    }
    return 0;
}`
    },
    {
      name: 'Sum of Array',
      desc: 'Adds all numbers in an array.',
      code: `#include <stdio.h>

int sum_array(int arr[], int size) {
    int total = 0;
    for (int i = 0; i < size; i++) {
        total += arr[i];
    }
    return total;
}

int main() {
    int values[] = {3, 7, 1, 9, 4, 6, 2};
    int length = sizeof(values) / sizeof(values[0]);
    int result = sum_array(values, length);
    printf("Sum: %d\\n", result);
    return 0;
}`
    },
    {
      name: 'Linked List Traversal',
      desc: 'Iterates through a linked list and prints each node.',
      code: `#include <stdio.h>
#include <stdlib.h>

struct Node {
    int data;
    struct Node *next;
};

struct Node* create_node(int value) {
    struct Node *node = malloc(sizeof(struct Node));
    node->data = value;
    node->next = NULL;
    return node;
}

void print_list(struct Node *head) {
    struct Node *current = head;
    while (current != NULL) {
        printf("%d -> ", current->data);
        current = current->next;
    }
    printf("NULL\\n");
}

int main() {
    struct Node *head = create_node(10);
    head->next = create_node(20);
    head->next->next = create_node(30);
    head->next->next->next = create_node(40);

    print_list(head);
    return 0;
}`
    },
    {
      name: 'Bubble Sort',
      desc: 'Sorts an array by repeatedly swapping adjacent elements.',
      code: `#include <stdio.h>

void bubble_sort(int arr[], int n) {
    for (int i = 0; i < n - 1; i++) {
        for (int j = 0; j < n - i - 1; j++) {
            if (arr[j] > arr[j + 1]) {
                int temp = arr[j];
                arr[j] = arr[j + 1];
                arr[j + 1] = temp;
            }
        }
    }
}

int main() {
    int data[] = {64, 34, 25, 12, 22, 11, 90};
    int n = sizeof(data) / sizeof(data[0]);

    bubble_sort(data, n);

    printf("Sorted: ");
    for (int i = 0; i < n; i++) {
        printf("%d ", data[i]);
    }
    printf("\\n");
    return 0;
}`
    },
    {
      name: 'Factorial Calculator',
      desc: 'Calculates the factorial of a number using recursion.',
      code: `#include <stdio.h>

long long factorial(int n) {
    if (n == 0 || n == 1) {
        return 1;
    }
    return n * factorial(n - 1);
}

int main() {
    int num = 5;
    long long result = factorial(num);
    
    printf("Factorial of %d is: %lld\\n", num, result);
    return 0;
}`
    },
    {
      name: 'Fibonacci Sequence',
      desc: 'Generates the Fibonacci series up to a specified number of terms.',
      code: `#include <stdio.h>

void print_fibonacci(int terms) {
    int t1 = 0, t2 = 1, nextTerm;

    printf("Fibonacci Sequence: ");

    for (int i = 1; i <= terms; ++i) {
        printf("%d, ", t1);
        nextTerm = t1 + t2;
        t1 = t2;
        t2 = nextTerm;
    }
    printf("\\n");
}

int main() {
    int num_terms = 10;
    print_fibonacci(num_terms);
    return 0;
}`
    },
    {
      name: 'Prime Number Check',
      desc: 'Checks if a given integer is a prime number.',
      code: `#include <stdio.h>

int is_prime(int n) {
    if (n <= 1) return 0;
    
    for (int i = 2; i * i <= n; i++) {
        if (n % i == 0) {
            return 0; // Not prime
        }
    }
    return 1; // Prime
}

int main() {
    int number = 29;
    
    if (is_prime(number)) {
        printf("%d is a prime number.\\n", number);
    } else {
        printf("%d is not a prime number.\\n", number);
    }
    return 0;
}`
    },
    {
      name: 'Matrix Addition',
      desc: 'Adds two 2D arrays (matrices) together.',
      code: `#include <stdio.h>

#define ROWS 2
#define COLS 2

void add_matrices(int m1[ROWS][COLS], int m2[ROWS][COLS], int result[ROWS][COLS]) {
    for (int i = 0; i < ROWS; i++) {
        for (int j = 0; j < COLS; j++) {
            result[i][j] = m1[i][j] + m2[i][j];
        }
    }
}

int main() {
    int matrixA[ROWS][COLS] = {{1, 2}, {3, 4}};
    int matrixB[ROWS][COLS] = {{5, 6}, {7, 8}};
    int sum[ROWS][COLS];

    add_matrices(matrixA, matrixB, sum);

    printf("Result matrix:\\n");
    for (int i = 0; i < ROWS; i++) {
        for (int j = 0; j < COLS; j++) {
            printf("%d ", sum[i][j]);
        }
        printf("\\n");
    }
    return 0;
}`
    },
    {
      name: 'String Reversal',
      desc: 'Reverses a string in place using pointers.',
      code: `#include <stdio.h>
#include <string.h>

void reverse_string(char *str) {
    int length = strlen(str);
    char *start = str;
    char *end = str + length - 1;
    char temp;

    while (start < end) {
        temp = *start;
        *start = *end;
        *end = temp;
        start++;
        end--;
    }
}

int main() {
    char text[] = "Hello World";
    
    printf("Original: %s\\n", text);
    reverse_string(text);
    printf("Reversed: %s\\n", text);
    
    return 0;
}`
    },
    {
      name: 'Swap Variables',
      desc: 'Swaps the values of two variables using pointers.',
      code: `#include <stdio.h>

void swap(int *a, int *b) {
    int temp = *a;
    *a = *b;
    *b = temp;
}

int main() {
    int x = 10;
    int y = 20;
    
    printf("Before swap: x=%d, y=%d\\n", x, y);
    swap(&x, &y);
    printf("After swap: x=%d, y=%d\\n", x, y);
    
    return 0;
}`
    }
  ];

  // ── DOM refs ──
  const trigger  = document.getElementById('snip-trigger');
  const menu     = document.getElementById('snip-menu');
  const dropdown = document.getElementById('snip-dropdown');
  const editor   = document.getElementById('code-editor');

  if (!trigger || !menu || !editor) return;

  // ── Build menu items ──
  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderMenu() {
    menu.innerHTML = SNIPPETS.map((s, i) => `
      <button class="snip-item" data-idx="${i}">
        <span class="snip-item__name">${esc(s.name)}</span>
        <span class="snip-item__desc">${esc(s.desc)}</span>
      </button>
    `).join('');

    menu.querySelectorAll('.snip-item').forEach(btn => {
      btn.addEventListener('click', () => {
        loadSnippet(parseInt(btn.dataset.idx, 10));
        closeMenu();
      });
    });
  }

  // ── Toggle dropdown ──
  function toggleMenu() {
    const open = dropdown.classList.toggle('snip-dropdown--open');
    trigger.setAttribute('aria-expanded', open);
  }

  function closeMenu() {
    dropdown.classList.remove('snip-dropdown--open');
    trigger.setAttribute('aria-expanded', 'false');
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu();
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target)) closeMenu();
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  // ── Load snippet into editor ──
  function loadSnippet(idx) {
    const snippet = SNIPPETS[idx];
    if (!snippet) return;

    editor.textContent = snippet.code;
    editor.dispatchEvent(new Event('input', { bubbles: true }));

    const codeArea = document.getElementById('code-area');
    if (codeArea) codeArea.scrollTop = 0;

    // Reset panels
    const panel = document.getElementById('explanation-panel');
    const overlay = document.getElementById('panel-overlay');
    if (panel) panel.classList.remove('open');
    if (overlay) overlay.classList.remove('visible');
  }

  renderMenu();
})();
