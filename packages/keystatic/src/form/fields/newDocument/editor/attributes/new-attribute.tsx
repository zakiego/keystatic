import { matchSorter } from 'match-sorter';
import { Command, TextSelection, Transaction } from 'prosemirror-state';
import { useMemo } from 'react';
import {
  addAutocompleteDecoration,
  removeAutocompleteDecoration,
  wrapCommandAfterRemovingAutocompleteDecoration,
} from '../autocomplete/decoration';
import {
  useEditorViewRef,
  useEditorState,
  useEditorDispatchCommand,
} from '../editor-view';
import { Item } from '@voussoir/editor';
import { InputRule } from '../inputrules/inputrules';
import { useEditorKeydownListener } from '../keydown';
import { EditorAutocomplete } from '../autocomplete/autocomplete';
import { ReplaceAroundStep } from 'prosemirror-transform';
import { Fragment, Node, ResolvedPos, Slice } from 'prosemirror-model';
import {
  canExistInAttributesContainer,
  getAttributeType,
  getAttributesContainerType,
  getAttributesType,
} from './schema';
import { assert } from 'emery';
import { getEditorSchema } from '../schema';
import { globalAttributes } from '@markdoc/markdoc';

type AttributeItem = {
  key: string;
  extra: string | undefined;
  command: Command;
};

export const attributeMenuInputRule: InputRule = {
  pattern: /(?:^|\s)%$/,
  handler(state, _match, _start, end) {
    return addNewAttributeAutocompleteDecoration(state.tr, end - 1, end);
  },
};

function getDeepestAncestorAttributeSchema(pos: ResolvedPos) {
  for (let depth = pos.depth; depth >= 0; depth--) {
    const node = pos.node(depth);
    if (node.type.name === 'paragraph' || node.type.name === 'heading') {
      return node as typeof node & { type: { name: 'paragraph' | 'heading' } };
    }
  }
}

export function addNewAttributeAutocompleteDecoration(
  tr: Transaction,
  from: number,
  to: number
): Transaction {
  return addAutocompleteDecoration(
    tr,
    NewAttributeMenu,
    from,
    to,
    /^(?:[a-zA-Z][-_a-zA-Z0-9]*)?$/
  );
}

function childRenderer(item: AttributeItem) {
  return (
    <Item key={item.key} textValue={item.key}>
      {item.key}
    </Item>
  );
}

function wrapInAttributeContainer(doc: Node, attributes: Node, pos: number) {
  const node = doc.nodeAt(pos);
  assert(!!node, 'node at pos must exist');
  const containerType = getAttributesContainerType(doc.type.schema);
  const container = containerType?.createChecked(null, [
    attributes,
    node.type.createAndFill()!,
  ]);
  const to = pos + node.nodeSize;
  const slice = new Slice(Fragment.from(container!), 0, 0);
  return new ReplaceAroundStep(
    pos,
    to,
    pos + 1,
    to - 1,
    slice,

    // for the opening of the attribute container
    1 +
      attributes.nodeSize +
      // for the opening of the actual element
      1,
    true
  );
}

function findAncestorWhereAttributesCanBeAdded(
  doc: Node,
  pos: number
):
  | { kind: 'needs-container'; posToBeWrapped: number }
  | { kind: 'can-add-attributes'; attributesPos: number }
  | undefined {
  const resolvedPos = doc.resolve(pos);
  for (let depth = resolvedPos.depth + 1; depth > 0; depth--) {
    const node =
      depth === resolvedPos.depth + 1
        ? resolvedPos.nodeAfter!
        : resolvedPos.node(depth);

    if (canExistInAttributesContainer(node.type)) {
      const parentDepth = depth - 1;
      const parent = resolvedPos.node(parentDepth);
      if (parent.type === getAttributesContainerType(node.type.schema)) {
        return {
          kind: 'can-add-attributes',
          attributesPos:
            resolvedPos.before(parentDepth) +
            // from before the attributes container to before the attributes node
            1,
        };
      }
      return {
        kind: 'needs-container',
        posToBeWrapped: resolvedPos.before(depth),
      };
    }
  }
}

function addAttribute(key: string): Command {
  return (state, dispatch) => {
    const sharedDepth = state.selection.$from.sharedDepth(state.selection.to);
    const sharedParentPos = state.selection.$from.before(sharedDepth);
    const ancestor = findAncestorWhereAttributesCanBeAdded(
      state.doc,
      sharedParentPos
    );
    if (!ancestor) return false;
    if (ancestor.kind === 'needs-container' && dispatch) {
      const tr = state.tr;
      tr.step(
        wrapInAttributeContainer(
          state.doc,
          getAttributesType(state.schema).createChecked(
            undefined,
            getAttributeType(state.schema).createAndFill({
              key,
            })!
          ),
          ancestor.posToBeWrapped
        )
      );
      const selection = TextSelection.findFrom(
        tr.doc.resolve(sharedParentPos),
        1,
        true
      );
      if (selection) {
        tr.setSelection(selection);
      }
      dispatch(tr);
    }
    if (ancestor.kind === 'can-add-attributes' && dispatch) {
      const attributesNode = state.doc.nodeAt(ancestor.attributesPos)!;
      let existingAttribute: { pos: number; nodeSize: number } | undefined;
      attributesNode.forEach((node, offset) => {
        if (
          node.type === getAttributeType(state.schema) &&
          node.attrs.key === key
        ) {
          existingAttribute = { pos: offset, nodeSize: node.nodeSize };
        }
      });
      if (existingAttribute !== undefined) {
        const baseFrom = ancestor.attributesPos + existingAttribute.pos;
        const { from } = TextSelection.near(state.tr.doc.resolve(baseFrom));
        const { to } = TextSelection.near(
          state.tr.doc.resolve(baseFrom + existingAttribute.nodeSize),
          -1
        );

        dispatch(
          state.tr.setSelection(
            new TextSelection(state.doc.resolve(from), state.doc.resolve(to))
          )
        );

        return true;
      }
      const beforeAttributesClosing =
        ancestor.attributesPos + attributesNode.nodeSize - 1;
      const tr = state.tr.insert(
        beforeAttributesClosing,
        getAttributeType(state.schema).createAndFill({
          key,
        })!
      );
      const selection = TextSelection.near(
        tr.doc.resolve(beforeAttributesClosing)
      );
      tr.setSelection(selection);
      dispatch(tr);
    }

    return true;
  };
}

function NewAttributeMenu(props: { query: string; from: number; to: number }) {
  const viewRef = useEditorViewRef();
  const dispatchCommand = useEditorDispatchCommand();
  const editorState = useEditorState();
  const ancestorNodeAllowingAttributes = getDeepestAncestorAttributeSchema(
    editorState.doc.resolve(props.from)
  );
  const options = useMemo(
    () =>
      matchSorter(
        ((): AttributeItem[] => {
          if (!ancestorNodeAllowingAttributes?.type) return [];
          const attributes = {
            ...globalAttributes,
            ...getEditorSchema(ancestorNodeAllowingAttributes.type.schema)
              .markdocConfig?.nodes?.[ancestorNodeAllowingAttributes.type.name]
              ?.attributes,
          };
          return Object.keys(attributes).map(key => ({
            key,
            extra: key === 'id' ? '#' : key === 'class' ? '.' : undefined,
            command: addAttribute(key),
          }));
        })(),
        props.query,
        {
          keys: ['key', 'extra'],
        }
      ),
    [props.query, ancestorNodeAllowingAttributes?.type]
  );

  useEditorKeydownListener(event => {
    if (event.key !== ' ') return false;
    if (options.length === 1) {
      // dispatchCommand(wrapInsertMenuCommand(options[0].command));
      return true;
    }
    if (options.length === 0) {
      viewRef.current?.dispatch(removeAutocompleteDecoration(editorState.tr));
    }
    return false;
  });
  return (
    <EditorAutocomplete
      from={props.from}
      to={props.to}
      aria-label="New attribute"
      items={options}
      children={childRenderer}
      onEscape={() => {
        viewRef.current?.dispatch(removeAutocompleteDecoration(editorState.tr));
      }}
      onAction={key => {
        const option = options.find(option => option.key === key);
        if (!option) return;
        dispatchCommand(
          wrapCommandAfterRemovingAutocompleteDecoration(
            addAttribute(option.key)
          )
        );
      }}
    />
  );
}
