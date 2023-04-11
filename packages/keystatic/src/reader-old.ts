import { ComponentSchema } from '.';
import { Collection, Config, Singleton } from '../config';
import {
  GeneralReader,
  collectionReader,
  singletonReader,
} from './generic-reader';

type FsReader<
  Collections extends {
    [key: string]: Collection<Record<string, ComponentSchema>, string>;
  },
  Singletons extends {
    [key: string]: Singleton<Record<string, ComponentSchema>>;
  }
> = GeneralReader<Collections, Singletons> & {
  repoPath: string;
};

export function createReader<
  Collections extends {
    [key: string]: Collection<Record<string, ComponentSchema>, string>;
  },
  Singletons extends {
    [key: string]: Singleton<Record<string, ComponentSchema>>;
  }
>(
  repoPath: string,
  config: Config<Collections, Singletons>
): FsReader<Collections, Singletons> {
  const minimalFs: MinimalFs = {};
  return {
    collections: Object.fromEntries(
      Object.keys(config.collections || {}).map(key => [
        key,
        collectionReader(key, config),
      ])
    ) as any,
    singletons: Object.fromEntries(
      Object.keys(config.singletons || {}).map(key => [
        key,
        singletonReader(key, config),
      ])
    ) as any,
    repoPath,
    config,
  };
}
