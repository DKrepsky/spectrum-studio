import { InlineMessage } from '../../ui/InlineMessage';
import { useSession } from '../../state/session';
import { ParamForm } from '../ParamForm';

/** Device-specific runtime settings of the connected source, rendered from its capabilities. */
export function SourcePanel() {
  const source = useSession((s) => s.status?.source);
  const busy = useSession((s) => s.busy);
  if (!source)
    return <InlineMessage variant="hint">Choose a source to see its settings.</InlineMessage>;
  const { params } = source.capabilities;
  if (params.length === 0)
    return <InlineMessage variant="hint">This source has no additional settings.</InlineMessage>;
  return (
    <ParamForm
      layout="inline"
      idPrefix="source"
      specs={params}
      values={source.settings.params}
      readOnly={busy === 'applying'}
      onChange={(id, value) =>
        void useSession
          .getState()
          .applySettings({ centerHz: null, spanHz: null, params: { [id]: value } })
      }
    />
  );
}
