import { ArrowSmallRightIcon } from '@heroicons/react/24/solid';

import Button from '../button';
import { useFormSubmission } from '../../hooks/useFormSubmission';
import { SEND_MESSAGE_TABLE_ID } from './table-id';

export default function SendMessageForm() {
  const { sendForm, isLoading } = useFormSubmission();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    sendForm({
      tableId: SEND_MESSAGE_TABLE_ID,
      form,
    });
  }

  return (
    <form className="flex flex-col gap-8" onSubmit={handleSubmit}>
      <input type="hidden" name="form-type" value="send-message" />
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label className="block text-sm font-medium" htmlFor="name">
            Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            className="form-input h-10 w-full rounded-lg border border-black px-4 py-2 leading-none"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="block text-sm font-medium" htmlFor="email">
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            className="form-input h-10 w-full rounded-lg border border-black px-4 py-2 leading-none"
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <label className="block text-sm font-medium" htmlFor="message">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={8}
          className="form-textarea w-full rounded-lg border border-black px-4 py-2 leading-none"
        />
      </div>

      <hr className="border-dashed border-t-black" />

      <p className="text-sm">
        We're building Keystatic in the open over the coming weeks and months.
        If you're interested in following along, there's a few ways you do
        that... No spam, just sharing the adventure!
      </p>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            className="form-input h-6 w-6 rounded-md border-2 border-black p-1 text-iris-11"
            id="opt-in-updates"
            name="opt-in-updates"
          />
          <label htmlFor="opt-in-updates" className="text-sm">
            I want to receive updates about our launch
          </label>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            className="form-input h-6 w-6 rounded-md border-2 border-black p-1 text-iris-11"
            id="opt-in-channel"
            name="opt-in-channel"
          />
          <label htmlFor="opt-in-channel" className="text-sm">
            I want to receive an invite to our early access channel
          </label>
        </div>
      </div>
      <Button
        className="flex flex-row justify-center gap-2 text-center sm:w-fit"
        type="submit"
        isLoading={isLoading}
      >
        <span>Continue</span>
        <ArrowSmallRightIcon className="h-4 w-4 fill-white" />
      </Button>
    </form>
  );
}
