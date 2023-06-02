// https://github.com/ProseMirror/prosemirror-gapcursor/blob/bbbee7d483754310f63f3b18d81f5a1da1250234/src/index.ts
import { keydownHandler } from 'prosemirror-keymap';
import {
  TextSelection,
  NodeSelection,
  Plugin,
  Command,
  EditorState,
} from 'prosemirror-state';
import { Fragment, Slice } from 'prosemirror-model';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';

import { NewAttributeCursor } from './new-attribute-cursor';
import { css } from '@voussoir/style';
import { addNewAttributeAutocompleteDecoration } from './new-attribute';

export function attributes(): Plugin {
  return new Plugin({
    props: {
      decorations: drawNewAttributeCursor,

      createSelectionBetween(_view, $anchor, $head) {
        return $anchor.pos == $head.pos && NewAttributeCursor.valid($head)
          ? new NewAttributeCursor($head)
          : null;
      },
      handleClick,
      handleKeyDown,
      handleTextInput(view, from, to, text) {
        return insertAttributeAutocomplete(text)(
          view.state,
          view.dispatch,
          view
        );
      },
      handleDOMEvents: { beforeinput },
    },
  });
}

export { NewAttributeCursor as GapCursor };

const handleKeyDown = keydownHandler({
  ArrowLeft: arrow(-1),
  ArrowRight: arrow(1),
  Enter: insertAttributeAutocomplete(''),
});

function insertAttributeAutocomplete(text: string): Command {
  return (state, dispatch) => {
    if (!(state.selection instanceof NewAttributeCursor)) return false;
    const textSelection = TextSelection.findFrom(
      state.selection.$from,
      1,
      true
    );
    console.log(textSelection);
    if (!textSelection) return false;
    if (!dispatch) return true;
    const textToInsert = '%' + text;
    const { tr } = state;
    tr.insertText(textToInsert, textSelection.from);
    const end = textSelection.from + textToInsert.length;
    addNewAttributeAutocompleteDecoration(tr, textSelection.from, end);
    tr.setSelection(TextSelection.create(tr.doc, end));
    dispatch?.(tr);
    return true;
  };
}

function arrow(dir: 1 | -1): Command {
  return function (state, dispatch, view) {
    let sel = state.selection;
    let $start = dir > 0 ? sel.$to : sel.$from,
      mustMove = sel.empty;
    if (sel instanceof TextSelection) {
      if (
        !view!.endOfTextblock(dir > 0 ? 'right' : 'left') ||
        $start.depth == 0
      ) {
        return false;
      }
      mustMove = false;
      $start = state.doc.resolve(dir > 0 ? $start.after() : $start.before());
    }
    let $found = NewAttributeCursor.findNewAttributeCursorFrom(
      $start,
      dir,
      mustMove
    );
    if (!$found) return false;
    if (dispatch) {
      dispatch(state.tr.setSelection(new NewAttributeCursor($found)));
    }
    return true;
  };
}

function handleClick(view: EditorView, pos: number, event: MouseEvent) {
  if (!view || !view.editable) return false;
  let $pos = view.state.doc.resolve(pos);
  if (!NewAttributeCursor.valid($pos)) return false;
  let clickPos = view.posAtCoords({ left: event.clientX, top: event.clientY });
  if (
    clickPos &&
    clickPos.inside > -1 &&
    NodeSelection.isSelectable(view.state.doc.nodeAt(clickPos.inside)!)
  ) {
    return false;
  }
  view.dispatch(view.state.tr.setSelection(new NewAttributeCursor($pos)));
  return true;
}

// This is a hack that, when a composition starts while a gap cursor
// is active, quickly creates an inline context for the composition to
// happen in, to avoid it being aborted by the DOM selection being
// moved into a valid position.
function beforeinput(view: EditorView, event: InputEvent) {
  if (!(view.state.selection instanceof NewAttributeCursor)) return false;
  if (event.inputType !== 'insertCompositionText') return false;

  let { $from } = view.state.selection;
  let insert = $from.parent
    .contentMatchAt($from.index())
    .findWrapping(view.state.schema.nodes.text);
  if (!insert) return false;

  let frag = Fragment.empty;
  for (let i = insert.length - 1; i >= 0; i--) {
    frag = Fragment.from(insert[i].createAndFill(null, frag));
  }
  let tr = view.state.tr.replace($from.pos, $from.pos, new Slice(frag, 0, 0));
  tr.setSelection(TextSelection.near(tr.doc.resolve($from.pos + 1)));
  view.dispatch(tr);
  return false;
}

const parent = css({
  position: 'relative',
});

const child = css({
  position: 'absolute',
  top: 0,
  left: -5,
  background: 'green',
  height: '1.2em',
  width: '4px',
});

function drawNewAttributeCursor(state: EditorState) {
  if (!(state.selection instanceof NewAttributeCursor)) return null;
  let node = document.createElement('div');
  node.className = parent;
  let childNode = document.createElement('div');
  childNode.className = child;
  node.appendChild(childNode);
  return DecorationSet.create(state.doc, [
    Decoration.widget(state.selection.head + 1, node, { key: 'new-attribute' }),
  ]);
}
