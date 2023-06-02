import { css } from '@voussoir/style';
import { EditorNodeSpec } from '../schema';
import { NodeType, Schema } from 'prosemirror-model';
import { weakMemoize } from '../utils';

export const canBeInAttributeContainer = 'can_be_in_attribute_container';

export const getAttributesContainerType = weakMemoize(
  function getAttributesContainerType(schema: Schema) {
    for (const node of Object.values(schema.nodes)) {
      if (node.spec === attributeSchema.attributes_container) {
        return node;
      }
    }
    throw new Error('No attributes container node found in the schema');
  }
);

export const getAttributesType = weakMemoize(function getAttributesType(
  schema: Schema
) {
  for (const node of Object.values(schema.nodes)) {
    if (node.spec === attributeSchema.attributes) {
      return node;
    }
  }
  throw new Error('No attributes node found in the schema');
});

export const getAttributeType = weakMemoize(function getAttributesType(
  schema: Schema
) {
  for (const node of Object.values(schema.nodes)) {
    if (node.spec === attributeSchema.attribute) {
      return node;
    }
  }
  throw new Error('No attributes node found in the schema');
});

export const canExistInAttributesContainer = weakMemoize(
  function canExistInAttributesContainer(type: NodeType) {
    if (!type.spec.group) {
      return false;
    }
    const groups = type.spec.group.split(' ');
    return groups.includes(canBeInAttributeContainer);
  }
);

export const attributeSchema = {
  attributes: {
    content: 'attribute+',
    toDOM() {
      return ['div', { class: css({ border: '1px black solid' }) }, 0];
    },
  },
  attribute: {
    attrs: {
      key: { default: 'attribute' },
    },
    content: 'attribute_expression',
    toDOM(node) {
      return [
        'div',
        { class: css({ border: '1px black solid' }) },
        ['div', { contenteditable: false }, `${node.attrs.key}:`],
        ['div', 0],
      ];
    },
  },
  attribute_string: {
    group: 'attribute_expression',
    content: 'text*',
    marks: '',
    toDOM() {
      return ['div', { class: css({ color: 'green' }) }, 0];
    },
  },
  attribute_null: {
    group: 'attribute_expression',
    toDOM() {
      return ['div', { class: css({ color: 'lightsteelblue' }) }, 'null'];
    },
  },
  attribute_true: {
    group: 'attribute_expression',
    toDOM() {
      return ['div', { class: css({ color: 'lightsteelblue' }) }, 'true'];
    },
  },
  attribute_false: {
    group: 'attribute_expression',
    toDOM() {
      return ['div', { class: css({ color: 'lightsteelblue' }) }, 'false'];
    },
  },
  attribute_number: {
    group: 'attribute_expression',
    content: 'text*',
    marks: '',
    toDOM() {
      return ['div', { class: css({ color: 'lightsteelblue' }) }, 'null'];
    },
  },
  attribute_variable: {
    group: 'attribute_expression',
    content: 'text*',
    marks: '',
    toDOM() {
      return [
        'div',
        { class: css({ color: 'lightsteelblue' }) },
        '$',
        ['div', 0],
      ];
    },
  },
  attribute_object: {
    group: 'attribute_expression',
    content: 'attribute*',
    marks: '',
    toDOM() {
      return [
        'div',
        ['div', { class: css({ color: 'green' }) }, , '{'],
        ['div', 0],
        ['div', { class: css({ color: 'green' }) }, , '}'],
      ];
    },
  },
  attributes_container: {
    content: `attributes ${canBeInAttributeContainer}`,
    toDOM() {
      return ['div', { class: css({ border: '1px black solid' }) }, 0];
    },
  },
} satisfies Record<string, EditorNodeSpec>;
