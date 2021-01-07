import { MessageUtils } from '../../utils';
import {
    CollectOptions,
    CollectorUtils,
    ExpireFunction,
    MessageFilter,
} from 'discord.js-collector-utils';
import { Message, MessageEmbed, MessageReaction, TextChannel, User } from 'discord.js';

import { BlacklistRepo } from '../../services/database/repos';
import { Lang } from '../../services';
import { LangCode } from '../../models/enums';

let Config = require('../../../config/config.json');

const COLLECT_OPTIONS: CollectOptions = {
    time: Config.experience.promptExpireTime * 1000,
    reset: true,
};

export class BlacklistClearSubCommand {
    constructor(private blacklistRepo: BlacklistRepo) { }

    public async execute(args: string[], msg: Message, channel: TextChannel) {
        let stopFilter: MessageFilter = (nextMsg: Message) =>
            nextMsg.author.id === msg.author.id &&
            [Config.prefix, ...Config.stopCommands].includes(
                nextMsg.content.split(/\s+/)[0].toLowerCase()
            );
        let expireFunction: ExpireFunction = async () => {
            await MessageUtils.send(
                channel,
                Lang.getEmbed('results.blacklistClearExired', LangCode.EN)
            );
        };

        let blacklisted = await this.blacklistRepo.getBlacklist(msg.guild.id);

        if (blacklisted.blacklist.length === 0) {
            await MessageUtils.send(channel, Lang.getEmbed('validation.emptyBlacklist', LangCode.EN));
            return;
        }

        let trueFalseOptions = [Config.emotes.confirm, Config.emotes.deny];

        let confirmationMessage = await MessageUtils.send(channel, Lang.getEmbed('serverPrompts.blacklistClearConfirmation', LangCode.EN, { TOTAL: blacklisted.blacklist.length.toString() })); // Send confirmation and emotes
        for (let option of trueFalseOptions) {
            await MessageUtils.react(confirmationMessage, option);
        }

        let confirmation: string = await CollectorUtils.collectByReaction(
            confirmationMessage,
            // Collect Filter
            (msgReaction: MessageReaction, reactor: User) =>
                reactor.id === msg.author.id && trueFalseOptions.includes(msgReaction.emoji.name),
            stopFilter,
            // Retrieve Result
            async (msgReaction: MessageReaction, reactor: User) => {
                return msgReaction.emoji.name;
            },
            expireFunction,
            COLLECT_OPTIONS
        );

        MessageUtils.delete(confirmationMessage);

        if (confirmation === undefined) return;

        if (confirmation === Config.emotes.confirm) {
            // Confirm
            await this.blacklistRepo.clearBlacklist(msg.guild.id);

            await MessageUtils.send(channel, Lang.getEmbed('results.blacklistClearSuccess', LangCode.EN));
        } else {
            await MessageUtils.send(channel, Lang.getEmbed('results.actionCanceled', LangCode.EN));
        }
    }
}
