/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type { TFunction } from 'i18next'

import type { ReplyError } from '../types'

/** What the error card offers, besides showing the details. */
export type ErrorFix = 'retry' | 'model' | 'wallet' | 'login' | 'new' | 'edit'

export type ErrorView = {
  kind:
    | 'model'
    | 'balance'
    | 'login'
    | 'busy'
    | 'long'
    | 'blocked'
    | 'vision'
    | 'upstream'
    | 'network'
    | 'other'
  fixes: ErrorFix[]
}

const has = (text: string, re: RegExp) => re.test(text)

/** Sorts a failed request into something a person can act on. */
export function classifyError(err: ReplyError): ErrorView {
  const text = `${err.code ?? ''} ${err.message}`.toLowerCase()
  const status = err.status ?? 0
  if (
    status === 401 ||
    has(
      text,
      /未登录|session expired|access token|unauthori[sz]ed|invalid token/
    )
  ) {
    return { kind: 'login', fixes: ['login'] }
  }
  if (
    has(
      text,
      /insufficient_user_quota|quota is not enough|额度不足|余额不足|pre_consume|insufficient balance/
    )
  ) {
    return { kind: 'balance', fixes: ['wallet', 'model'] }
  }
  if (
    has(
      text,
      /model_not_found|无可用渠道|no available channel|model .*(?:not found|does not exist|not available)|不存在该模型|model_not_available/
    )
  ) {
    return { kind: 'model', fixes: ['model'] }
  }
  if (
    has(text, /image|vision|multimodal|多模态|图片/) &&
    has(text, /not support|unsupported|不支持|invalid content|cannot read/)
  ) {
    return { kind: 'vision', fixes: ['model'] }
  }
  if (
    has(
      text,
      /context_length|context length|maximum context|too many tokens|token limit|prompt is too long|上下文/
    )
  ) {
    return { kind: 'long', fixes: ['new', 'model'] }
  }
  if (
    has(
      text,
      /content_policy|safety|moderation|blocked|sensitive|敏感|违规|prohibited/
    )
  ) {
    return { kind: 'blocked', fixes: ['edit'] }
  }
  if (status === 429 || has(text, /rate limit|too many requests|频繁|限流/)) {
    return { kind: 'busy', fixes: ['retry', 'model'] }
  }
  if (
    err.code === 'network' ||
    has(text, /failed to fetch|network|networkerror|load failed/)
  ) {
    return { kind: 'network', fixes: ['retry'] }
  }
  if (
    status >= 500 ||
    has(text, /upstream|timeout|timed out|bad gateway|overloaded/)
  ) {
    return { kind: 'upstream', fixes: ['retry', 'model'] }
  }
  return { kind: 'other', fixes: ['retry', 'model'] }
}

export function errorTitle(
  view: ErrorView,
  model: string,
  t: TFunction
): string {
  switch (view.kind) {
    case 'model':
      return t('{{model}} is not available right now', { model })
    case 'balance':
      return t('Your balance is too low')
    case 'login':
      return t('Your sign-in has expired')
    case 'busy':
      return t('Too many requests at once')
    case 'long':
      return t('This conversation is too long for {{model}}', { model })
    case 'blocked':
      return t('The request was blocked')
    case 'vision':
      return t('{{model}} cannot read pictures', { model })
    case 'upstream':
      return t('The model provider had a problem')
    case 'network':
      return t('The connection dropped')
    default:
      return t('Something went wrong')
  }
}

export function errorHint(view: ErrorView, t: TFunction): string {
  switch (view.kind) {
    case 'model':
      return t(
        'The provider is not offering this model at the moment. Pick another one.'
      )
    case 'balance':
      return t('Top up your wallet, or pick a cheaper model.')
    case 'login':
      return t('Sign in again, then send the message once more.')
    case 'busy':
      return t('Wait a few seconds and try again.')
    case 'long':
      return t(
        'Start a new conversation, or pick a model with a longer context.'
      )
    case 'blocked':
      return t('Rephrase the message and send it again.')
    case 'vision':
      return t('Pick a model that can see pictures, or remove the picture.')
    case 'upstream':
      return t('Trying again in a moment usually works.')
    case 'network':
      return t('Check your network and try again.')
    default:
      return t('Try again, or pick another model.')
  }
}
