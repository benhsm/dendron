import {
  DendronError,
  DVault,
  NoteUtils,
  RespV3,
  VaultUtils,
} from "@dendronhq/common-all";
import _ from "lodash";
import { DENDRON_COMMANDS } from "../constants";
import { IDendronExtension } from "../dendronExtensionInterface";
import { ExtensionProvider } from "../ExtensionProvider";
import { getLinkFromSelectionWithWorkspace } from "../utils/editor";
import { BasicCommand } from "./base";
import { GotoNoteCommand } from "./GotoNote";
import { GoToNoteCommandOutput, TargetKind } from "./GoToNoteInterface";
import { OpenLinkCommand } from "./OpenLink";

type CommandOpts = {};

type CommandInput = {};

type CommandOutput = RespV3<GoToNoteCommandOutput>;

const GOTO_KEY = "uri";

export class GotoCommand extends BasicCommand<CommandOpts, CommandOutput> {
  key = DENDRON_COMMANDS.GOTO.key;

  constructor(private _ext: IDendronExtension) {
    super();
  }

  async gatherInputs(): Promise<CommandInput | undefined> {
    return {};
  }
  async execute(): Promise<CommandOutput> {
    const { vaults, engine } = ExtensionProvider.getDWorkspace();

    const link = await getLinkFromSelectionWithWorkspace();
    if (!link) {
      return {
        error: new DendronError({ message: "selection is not a valid link" }),
      };
    }

    // get vault
    let vault: DVault | undefined;
    const { anchorHeader, value: fname, vaultName } = link;
    if (vaultName) {
      vault = VaultUtils.getVaultByNameOrThrow({
        vaults,
        vname: vaultName,
      });
    }

    // get note
    const notes = NoteUtils.getNotesByFnameFromEngine({
      fname,
      engine,
      vault,
    });
    if (notes.length === 0) {
      return {
        error: new DendronError({ message: "selection is not a note" }),
      };
    }

    // TODO: for now, get first note, in the future, show prompt
    const note = notes[0];

    // if note doesn't have url, run goto note command
    if (_.isUndefined(note.custom[GOTO_KEY])) {
      const resp = await new GotoNoteCommand(this._ext).execute({
        qs: note.fname,
        vault: note.vault,
        anchor: anchorHeader,
      });
      return { data: resp };
    }

    await this.openLink(note.custom[GOTO_KEY]);
    // we found a link
    return {
      data: {
        kind: TargetKind.LINK,
        fullPath: note.custom[GOTO_KEY],
      },
    };
  }

  private openLink(uri: string) {
    return new OpenLinkCommand().execute({ uri });
  }
}
