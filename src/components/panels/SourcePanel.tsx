import { useSession } from '../../state/session';
import { ParamForm } from '../ParamForm';

/** Device-specific runtime settings of the connected source, rendered from its capabilities. */
export function SourcePanel() {
  const source = useSession((s) => s.status?.source);
  const busy = useSession((s) => s.busy);
  if (!source) return <p className="hint panel-body">Choose a source to see its settings.</p>;
  const { params } = source.capabilities;
  if (params.length === 0)
    return <p className="hint panel-body">This source has no additional settings.</p>;
  return (
    <div className="panel-body">
      <ParamForm
        idPrefix="source"
        specs={params}
        values={source.settings.params}
        disabled={busy === 'applying'}
        onChange={(id, value) =>
          void useSession
            .getState()
            .applySettings({ centerHz: null, spanHz: null, params: { [id]: value } })
        }
      />
    </div>
  );
}
