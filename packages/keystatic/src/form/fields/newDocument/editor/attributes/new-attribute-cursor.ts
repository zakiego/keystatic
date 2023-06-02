// https://github.com/ProseMirror/prosemirror-gapcursor/blob/bbbee7d483754310f63f3b18d81f5a1da1250234/src/gapcursor.ts#L1
import { Selection, NodeSelection } from 'prosemirror-state';
import { Slice, ResolvedPos, Node } from 'prosemirror-model';
import { Mappable } from 'prosemirror-transform';
import {
  canExistInAttributesContainer,
  getAttributesContainerType,
} from './schema';

/// Gap cursor selections are represented using this class. Its
/// `$anchor` and `$head` properties both point at the cursor position.
export class NewAttributeCursor extends Selection {
  /// Create a gap cursor.
  constructor($pos: ResolvedPos) {
    super($pos, $pos);
  }

  map(doc: Node, mapping: Mappable): Selection {
    let $pos = doc.resolve(mapping.map(this.head));
    return NewAttributeCursor.valid($pos)
      ? new NewAttributeCursor($pos)
      : Selection.near($pos);
  }

  content() {
    return Slice.empty;
  }

  eq(other: Selection): boolean {
    return other instanceof NewAttributeCursor && other.head == this.head;
  }

  toJSON(): unknown {
    return { type: 'new-attribute-cursor', pos: this.head };
  }

  /// @internal
  static fromJSON(doc: Node, json: unknown): NewAttributeCursor {
    if (
      typeof json !== 'object' ||
      json === null ||
      !('pos' in json) ||
      typeof json?.pos != 'number'
    ) {
      throw new RangeError('Invalid input for NewAttributeCursor.fromJSON');
    }
    return new NewAttributeCursor(doc.resolve(json.pos));
  }

  getBookmark() {
    return new NewAttributeBookmark(this.anchor);
  }

  static valid($pos: ResolvedPos) {
    const node = $pos.doc.nodeAt($pos.pos);
    if (!node) return false;
    return (
      canExistInAttributesContainer(node.type) &&
      $pos.parent.type !== getAttributesContainerType($pos.doc.type.schema)
    );
  }

  static findNewAttributeCursorFrom(
    $pos: ResolvedPos,
    dir: number,
    mustMove = false
  ) {
    search: for (;;) {
      if (!mustMove && NewAttributeCursor.valid($pos)) return $pos;
      let pos = $pos.pos,
        next = null;
      // Scan up from this position
      for (let d = $pos.depth; ; d--) {
        let parent = $pos.node(d);
        if (
          dir > 0 ? $pos.indexAfter(d) < parent.childCount : $pos.index(d) > 0
        ) {
          next = parent.child(dir > 0 ? $pos.indexAfter(d) : $pos.index(d) - 1);
          break;
        } else if (d == 0) {
          return null;
        }
        pos += dir;
        let $cur = $pos.doc.resolve(pos);
        if (NewAttributeCursor.valid($cur)) return $cur;
      }

      // And then down into the next node
      for (;;) {
        let inside: Node | null = dir > 0 ? next.firstChild : next.lastChild;
        if (!inside) {
          if (
            next.isAtom &&
            !next.isText &&
            !NodeSelection.isSelectable(next)
          ) {
            $pos = $pos.doc.resolve(pos + next.nodeSize * dir);
            mustMove = false;
            continue search;
          }
          break;
        }
        next = inside;
        pos += dir;
        let $cur = $pos.doc.resolve(pos);
        if (NewAttributeCursor.valid($cur)) return $cur;
      }

      return null;
    }
  }
}

NewAttributeCursor.prototype.visible = false;
(NewAttributeCursor as any).findFrom =
  NewAttributeCursor.findNewAttributeCursorFrom;

Selection.jsonID('new-attribute-cursor', NewAttributeCursor);

class NewAttributeBookmark {
  constructor(readonly pos: number) {}

  map(mapping: Mappable) {
    return new NewAttributeBookmark(mapping.map(this.pos));
  }
  resolve(doc: Node) {
    let $pos = doc.resolve(this.pos);
    return NewAttributeCursor.valid($pos)
      ? new NewAttributeCursor($pos)
      : Selection.near($pos);
  }
}
