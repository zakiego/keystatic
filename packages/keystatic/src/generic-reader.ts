import { Collection, Config, Glob, Singleton } from '../config';
import {
  ComponentSchema,
  fields,
  ObjectField,
  SlugFormField,
  ValueForReading,
  ValueForReadingDeep,
} from '../DocumentEditor/component-blocks/api';
import {
  FormatInfo,
  getCollectionFormat,
  getCollectionItemPath,
  getCollectionPath,
  getDataFileExtension,
  getEntryDataFilepath,
  getSingletonFormat,
  getSingletonPath,
  getSlugGlobForCollection,
} from '../app/path-utils';
import { validateComponentBlockProps } from '../validate-component-block-props';
import {
  getRequiredFiles,
  loadDataFile,
  parseSerializedFormField,
} from '../app/required-files';
import { getValueAtPropPath } from '../DocumentEditor/component-blocks/props-value';

type EntryReaderOpts = { resolveLinkedFiles?: boolean };

type ValueForReadingWithMode<
  Schema extends ComponentSchema,
  Opts extends boolean | undefined,
> = Opts extends true ? ValueForReadingDeep<Schema> : ValueForReading<Schema>;

type OptionalChain<
  T extends {} | undefined,
  Key extends keyof (T & {}),
> = T extends {} ? T[Key] : undefined;

type CollectionReader<
  Schema extends Record<string, ComponentSchema>,
  SlugField extends string,
> = {
  read: <Opts extends [opts?: EntryReaderOpts]>(
    slug: string,
    ...opts: Opts & [opts?: EntryReaderOpts]
  ) => Promise<
    | {
        [Key in keyof Schema]: SlugField extends Key
          ? Schema[Key] extends SlugFormField<any, infer SlugSerializedValue>
            ? SlugSerializedValue
            : ValueForReadingWithMode<
                Schema[Key],
                OptionalChain<Opts[0], 'resolveLinkedFiles'>
              >
          : ValueForReadingWithMode<
              Schema[Key],
              OptionalChain<Opts[0], 'resolveLinkedFiles'>
            >;
      }
    | null
  >;
  all: <Opts extends [opts?: EntryReaderOpts]>(
    ...opts: Opts & [opts?: EntryReaderOpts]
  ) => Promise<
    {
      slug: string;
      entry: {
        [Key in keyof Schema]: SlugField extends Key
          ? Schema[Key] extends SlugFormField<any, infer SlugSerializedValue>
            ? SlugSerializedValue
            : ValueForReadingWithMode<
                Schema[Key],
                OptionalChain<Opts[0], 'resolveLinkedFiles'>
              >
          : ValueForReadingWithMode<
              Schema[Key],
              OptionalChain<Opts[0], 'resolveLinkedFiles'>
            >;
      };
    }[]
  >;
  list: () => Promise<string[]>;
};

type SingletonReader<Schema extends Record<string, ComponentSchema>> = {
  read: <Opts extends [opts?: EntryReaderOpts]>(
    ...opts: Opts & [opts?: EntryReaderOpts]
  ) => Promise<ValueForReadingWithMode<
    ObjectField<Schema>,
    OptionalChain<Opts[0], 'resolveLinkedFiles'>
  > | null>;
};

async function getAllEntries(
  parent: string,
  fsReader: MinimalFs
): Promise<{ entry: DirEntry; name: string }[]> {
  return (
    await Promise.all(
      (await fsReader.readdir(parent)).map(async dirent => {
        const name = `${parent}${dirent.name}`;
        const entry = { entry: dirent, name };
        if (dirent.kind === 'directory') {
          return [entry, ...(await getAllEntries(`${name}/`, fsReader))];
        }
        return entry;
      })
    )
  ).flat();
}

type DirEntry = { name: string; kind: 'file' | 'directory' };

export type MinimalFs = {
  readFile(path: string): Promise<Uint8Array | null>;
  readdir(path: string): Promise<DirEntry[]>;
  fileExists(path: string): Promise<boolean>;
};

export function collectionReader(
  collection: string,
  config: Config,
  getFsReader: () => MinimalFs
): CollectionReader<any, any> {
  const formatInfo = getCollectionFormat(config, collection);
  const collectionPath = getCollectionPath(config, collection);
  const collectionConfig = config.collections![collection];
  const schema = fields.object(collectionConfig.schema);
  const glob = getSlugGlobForCollection(config, collection);
  const extension = getDataFileExtension(formatInfo);
  async function list(fsReader: MinimalFs) {
    const entries: { entry: DirEntry; name: string }[] =
      glob === '*'
        ? (await fsReader.readdir(collectionPath)).map(entry => ({
            entry,
            name: entry.name,
          }))
        : (await getAllEntries(`${collectionPath}/`, fsReader)).map(x => ({
            entry: x.entry,
            name: x.name.slice(collectionPath.length + 1),
          }));

    return (
      await Promise.all(
        entries.map(async x => {
          if (formatInfo.dataLocation === 'index') {
            if (x.entry.kind !== 'directory') return [];
            if (
              !(await fsReader.fileExists(
                getEntryDataFilepath(`${collectionPath}/${x.name}`, formatInfo)
              ))
            ) {
              return [];
            }
            return [x.name];
          } else {
            if (x.entry.kind !== 'file' || !x.name.endsWith(extension)) {
              return [];
            }
            return [x.name.slice(0, -extension.length)];
          }
        })
      )
    ).flat();
  }
  const read: CollectionReader<any, any>['read'] = (slug, ...args) =>
    readItem(
      schema,
      formatInfo,
      getCollectionItemPath(config, collection, slug),
      { field: collectionConfig.slugField, slug, glob },
      getFsReader(),
      args[0]
    );

  return {
    read,
    // TODO: this could drop the fs.stat call that list does for each item
    // since we just immediately read it
    all: async (...args) => {
      const reader = getFsReader();
      const slugs = await list(reader);
      return (
        await Promise.all(
          slugs.map(async slug => {
            const entry = await read(slug, args[0]);
            if (entry === null) return [];
            return [{ slug, entry }];
          })
        )
      ).flat();
    },
    list: () => list(getFsReader()),
  };
}

async function readItem(
  schema: ComponentSchema,
  formatInfo: FormatInfo,
  itemDir: string,
  slugField:
    | {
        slug: string;
        field: string;
        glob: Glob;
      }
    | undefined,
  fsReader: MinimalFs,
  opts: EntryReaderOpts | undefined
) {
  const dataFile = await fsReader.readFile(
    getEntryDataFilepath(itemDir, formatInfo)
  );
  if (dataFile === null) return null;
  const { loaded, extraFakeFile } = loadDataFile(dataFile, formatInfo);
  const validated = validateComponentBlockProps(
    schema,
    loaded,
    [],
    slugField === undefined
      ? undefined
      : {
          field: slugField.field,
          slug: slugField.slug,
          mode: 'read',
          slugs: new Set(),
          glob: slugField.glob,
        }
  );
  const requiredFiles = getRequiredFiles(validated, schema, slugField?.slug);
  await Promise.all(
    requiredFiles.map(async file => {
      const parentValue = getValueAtPropPath(
        validated,
        file.path.slice(0, -1)
      ) as any;
      const keyOnParent = file.path[file.path.length - 1];
      const originalValue = parentValue[keyOnParent];
      if (file.schema.serializeToFile.reader.requiresContentInReader) {
        const loadData = async () => {
          const loadedFiles = new Map<string, Uint8Array>();
          if (file.file) {
            const filepath = `${
              file.file.parent
                ? `${file.file.parent}${slugField ? slugField.slug : ''}`
                : itemDir
            }/${file.file.filename}`;
            if (file.file.filename === extraFakeFile?.path) {
              loadedFiles.set(filepath, extraFakeFile.contents);
            } else {
              const contents = await fsReader.readFile(filepath);

              if (contents) {
                loadedFiles.set(filepath, contents);
              }
            }
          }
          return parseSerializedFormField(
            originalValue,
            file,
            loadedFiles,
            'read',
            itemDir,
            slugField?.slug,
            validated,
            schema
          );
        };
        if (opts?.resolveLinkedFiles) {
          parentValue[keyOnParent] = await loadData();
        } else {
          parentValue[keyOnParent] = loadData;
        }
      } else {
        parentValue[keyOnParent] = parseSerializedFormField(
          originalValue,
          file,
          new Map(),
          'read',
          itemDir,
          slugField?.slug,
          validated,
          schema
        );
      }
    })
  );

  return validated;
}

export function singletonReader(
  singleton: string,
  config: Config,
  fsReader: () => MinimalFs
): SingletonReader<any> {
  const formatInfo = getSingletonFormat(config, singleton);
  const singletonPath = getSingletonPath(config, singleton);
  const schema = fields.object(config.singletons![singleton].schema);
  return {
    read: (...args) =>
      readItem(
        schema,
        formatInfo,
        singletonPath,
        undefined,
        fsReader(),
        args[0]
      ),
  };
}

export type GeneralReader<
  Collections extends {
    [key: string]: Collection<Record<string, ComponentSchema>, string>;
  },
  Singletons extends {
    [key: string]: Singleton<Record<string, ComponentSchema>>;
  },
> = {
  collections: {
    [Key in keyof Collections]: CollectionReader<
      Collections[Key]['schema'],
      Collections[Key]['slugField']
    >;
  };
  singletons: {
    [Key in keyof Singletons]: SingletonReader<Singletons[Key]['schema']>;
  };
  config: Config<Collections, Singletons>;
};
