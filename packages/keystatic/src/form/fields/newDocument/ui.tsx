'use client';
import { FieldPrimitive } from '@voussoir/field';
import { ComponentBlock, FormFieldInputProps } from '../../api';
import { EditorState } from 'prosemirror-state';
import { Editor } from './editor';
import { DocumentFeatures } from './document-features';

export function DocumentFieldInput(
  props: FormFieldInputProps<EditorState> & {
    label: string;
    description: string | undefined;
    componentBlocks: Record<string, ComponentBlock>;
    documentFeatures: DocumentFeatures;
  }
) {
  return (
    <FieldPrimitive label={props.label} description={props.description}>
      <Editor value={props.value} onChange={props.onChange} />
    </FieldPrimitive>
  );
}
