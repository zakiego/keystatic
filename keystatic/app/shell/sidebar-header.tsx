import { Section, Item } from '@react-stately/collections';
import { gql } from '@ts-gql/tag/no-transform';
import { AlertDialog, DialogContainer } from '@voussoir/dialog';
import { Icon } from '@voussoir/icon';
import { externalLinkIcon } from '@voussoir/icon/icons/externalLinkIcon';
import { gitBranchPlusIcon } from '@voussoir/icon/icons/gitBranchPlusIcon';
import { trashIcon } from '@voussoir/icon/icons/trashIcon';
import { Flex } from '@voussoir/layout';
import { ActionMenu } from '@voussoir/menu';
import { Text } from '@voussoir/typography';
import router from 'next/router';
import { ReactElement, useContext, useMemo, useReducer } from 'react';
import { useMutation } from 'urql';
import { BranchPicker, CreateBranchDialog } from '../branch-selection';
import { BranchInfoContext, useBaseCommit, useRepositoryId } from './data';

export function SidebarHeader(props: { repo: { owner: string; name: string } }) {
  const data = useContext(BranchInfoContext);
  const baseCommit = useBaseCommit();
  const repositoryId = useRepositoryId();
  const [newBranchDialogVisible, toggleNewBranchDialog] = useReducer(v => !v, false);
  const [deleteBranchDialogVisible, toggleDeleteBranchDialog] = useReducer(v => !v, false);
  const [, deleteBranch] = useMutation(
    gql`
      mutation DeleteBranch($refId: ID!) {
        deleteRef(input: { refId: $refId }) {
          __typename
        }
      }
    ` as import('../../__generated__/ts-gql/DeleteBranch').type
  );
  type GitItem = { icon: ReactElement; label: string; description: string; key: string };
  type GitSection = { key: string; label: string; children: GitItem[] };
  const gitMenuItems = useMemo(() => {
    let isDefaultBranch = data.currentBranch === data.defaultBranch;
    let items: GitSection[] = [
      {
        key: 'branch-section',
        label: 'Branches',
        children: [
          {
            key: 'new-branch',
            icon: gitBranchPlusIcon,
            label: 'New branch',
            description: `Create a new branch based on "${data.currentBranch}"`,
          },
        ],
      },
    ];
    let prSection: GitItem[] = [];
    if (!isDefaultBranch) {
      prSection.push({
        key: 'create-pull-request',
        icon: externalLinkIcon,
        label: 'Create pull request',
        description: 'Open a PR against this branch',
      });
      if (!data.hasPullRequests) {
        prSection.push({
          key: 'delete-branch',
          icon: trashIcon,
          label: 'Delete branch',
          description: 'Delete this branch',
        });
      }
    }

    if (data.hasPullRequests) {
      prSection.push({
        key: 'related-pull-requests',
        icon: externalLinkIcon,
        label: 'View pull requests',
        description: 'See the PRs for this branch',
      });
    }

    if (prSection.length) {
      items.push({
        key: 'pr-section',
        label: 'Pull requests',
        children: prSection,
      });
    }

    return items;
  }, [data.currentBranch, data.defaultBranch, data.hasPullRequests]);
  return (
    <Flex gap="regular" paddingX="xlarge" borderBottom="muted" height="xlarge" alignItems="center">
      <BranchPicker
        currentBranch={data.currentBranch}
        defaultBranch={data.defaultBranch}
        allBranches={data.allBranches}
      />

      <ActionMenu
        aria-label="git actions"
        prominence="low"
        items={gitMenuItems}
        onAction={key => {
          let repoURL = `https://github.com/${props.repo.owner}/${props.repo.name}`;
          switch (key) {
            case 'new-branch':
              toggleNewBranchDialog();
              break;
            case 'delete-branch': {
              toggleDeleteBranchDialog();
              break;
            }
            case 'related-pull-requests':
              let query = [
                ['is', 'pr'],
                ['is', 'open'],
                ['head', data.currentBranch],
              ]
                .map(([key, value]) => encodeURIComponent(`${key}:${value}`))
                .join('+');

              window.open(`${repoURL}/pulls?q=${query}`);
              break;
            case 'create-pull-request':
              window.open(`${repoURL}/pull/new/${data.currentBranch}`);
              break;
          }
        }}
      >
        {item => (
          <Section key={item.key} items={item.children} aria-label={item.label}>
            {item => (
              <Item key={item.key}>
                <Icon src={item.icon} />
                <Text>{item.label}</Text>
                <Text slot="description">{item.description}</Text>
              </Item>
            )}
          </Section>
        )}
      </ActionMenu>

      <DialogContainer onDismiss={toggleNewBranchDialog}>
        {newBranchDialogVisible && (
          <CreateBranchDialog
            onDismiss={toggleNewBranchDialog}
            onCreate={branchName => {
              toggleNewBranchDialog();
              router.push(router.asPath.replace(/\/branch\/[^/]+/, '/branch/' + branchName));
            }}
            branchOid={baseCommit}
            repositoryId={repositoryId}
          />
        )}
      </DialogContainer>

      <DialogContainer onDismiss={toggleDeleteBranchDialog}>
        {deleteBranchDialogVisible && (
          <AlertDialog
            title="Delete branch"
            tone="critical"
            cancelLabel="Cancel"
            primaryActionLabel="Yes, delete"
            autoFocusButton="cancel"
            onPrimaryAction={async () => {
              await deleteBranch({ refId: data.branchNameToId.get(data.currentBranch)! });
              router.push(
                router.asPath.replace(/\/branch\/[^/]+/, '/branch/' + data.defaultBranch)
              );
            }}
          >
            Are you sure you want to delete the "{data.currentBranch}" branch? This cannot be
            undone.
          </AlertDialog>
        )}
      </DialogContainer>
    </Flex>
  );
}