import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestCaseEditor, TestCase } from '@/components/testing/TestCaseEditor';

// Mock @dnd-kit to avoid complex drag simulation
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}));

vi.mock('@dnd-kit/sortable', async () => {
  const { arrayMove } = await vi.importActual<typeof import('@dnd-kit/sortable')>('@dnd-kit/sortable');
  return {
    arrayMove,
    SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    sortableKeyboardCoordinates: vi.fn(),
    useSortable: vi.fn(() => ({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      transform: null,
      transition: null,
      isDragging: false,
    })),
    verticalListSortingStrategy: vi.fn(),
  };
});

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: vi.fn(() => ''),
    },
  },
}));

describe('TestCaseEditor', () => {
  const mockTestCases: TestCase[] = [
    { _id: 'tc-1', name: 'Test Case 1', inputs: { var1: 'value1' }, tags: ['smoke'] },
    { _id: 'tc-2', name: 'Test Case 2', inputs: { var1: 'value2' }, tags: ['regression'] },
    { _id: 'tc-3', name: 'Test Case 3', inputs: { var1: 'value3' }, tags: [] },
  ];

  const mockVariables = ['var1'];

  describe('Rendering', () => {
    it('should render all test cases', () => {
      const onChange = vi.fn();

      render(
        <TestCaseEditor
          testCases={mockTestCases}
          variables={mockVariables}
          onChange={onChange}
        />
      );

      expect(screen.getByText('Test Case 1')).toBeInTheDocument();
      expect(screen.getByText('Test Case 2')).toBeInTheDocument();
      expect(screen.getByText('Test Case 3')).toBeInTheDocument();
    });

    it('should render empty state when no test cases', () => {
      const onChange = vi.fn();

      render(
        <TestCaseEditor
          testCases={[]}
          variables={mockVariables}
          onChange={onChange}
        />
      );

      expect(screen.getByText('No test cases yet.')).toBeInTheDocument();
    });

    it('should render tags on test cases', () => {
      const onChange = vi.fn();

      render(
        <TestCaseEditor
          testCases={mockTestCases}
          variables={mockVariables}
          onChange={onChange}
        />
      );

      expect(screen.getByText('smoke')).toBeInTheDocument();
      expect(screen.getByText('regression')).toBeInTheDocument();
    });
  });

  describe('Array reordering (arrayMove)', () => {
    it('should correctly reorder array when moving item forward', async () => {
      const { arrayMove } = await import('@dnd-kit/sortable');

      const items = ['a', 'b', 'c', 'd'];
      const result = arrayMove(items, 0, 2);

      expect(result).toEqual(['b', 'c', 'a', 'd']);
    });

    it('should correctly reorder array when moving item backward', async () => {
      const { arrayMove } = await import('@dnd-kit/sortable');

      const items = ['a', 'b', 'c', 'd'];
      const result = arrayMove(items, 3, 1);

      expect(result).toEqual(['a', 'd', 'b', 'c']);
    });

    it('should not change array when moving to same position', async () => {
      const { arrayMove } = await import('@dnd-kit/sortable');

      const items = ['a', 'b', 'c'];
      const result = arrayMove(items, 1, 1);

      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should handle test case objects correctly', async () => {
      const { arrayMove } = await import('@dnd-kit/sortable');

      const testCases = [
        { _id: '1', name: 'First' },
        { _id: '2', name: 'Second' },
        { _id: '3', name: 'Third' },
      ];

      const result = arrayMove(testCases, 2, 0);

      expect(result[0].name).toBe('Third');
      expect(result[1].name).toBe('First');
      expect(result[2].name).toBe('Second');
    });
  });

  describe('Selection', () => {
    it('should show checkboxes when onSelectionChange is provided', () => {
      const onChange = vi.fn();
      const onSelectionChange = vi.fn();

      render(
        <TestCaseEditor
          testCases={mockTestCases}
          variables={mockVariables}
          onChange={onChange}
          selectedCaseIds={[]}
          onSelectionChange={onSelectionChange}
        />
      );

      // Should have checkboxes (3 for rows + 1 for select all)
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBe(4);
    });

    it('should not show checkboxes when onSelectionChange is not provided', () => {
      const onChange = vi.fn();

      render(
        <TestCaseEditor
          testCases={mockTestCases}
          variables={mockVariables}
          onChange={onChange}
        />
      );

      const checkboxes = screen.queryAllByRole('checkbox');
      expect(checkboxes.length).toBe(0);
    });
  });
});
