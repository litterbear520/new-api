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
import {
  ChevronDown,
  Code2,
  Download,
  Ellipsis,
  FileJson,
  PanelRight,
  Pencil,
  SquarePen,
  Trash2,
  Upload,
} from 'lucide-react'
import { memo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useRelativeTime } from '@/features/draw/components/relative-time'
import { Tip } from '@/features/draw/components/tip'
import { cn } from '@/lib/utils'
import { currentConversation, useBearChatStore } from '@/stores/bear-chat-store'

import { lastRequest } from '../lib/run'
import {
  downloadText,
  fileSafe,
  fromJson,
  toJson,
  toMarkdown,
} from '../lib/transfer'
import { CodeDialog } from './code-dialog'

/** The list itself; it only subscribes to the conversations while open. */
function HistoryList(props: { onPicked: () => void }) {
  const { t } = useTranslation()
  const ago = useRelativeTime()
  const convs = useBearChatStore((s) => s.convs)
  const curId = useBearChatStore((s) => s.curId)
  const select = useBearChatStore((s) => s.select)
  return (
    <Command loop>
      {/* always there, so arrows and Enter work from the keyboard */}
      <CommandInput autoFocus placeholder={t('Search conversations')} />
      <CommandList className='max-h-[min(440px,60vh)]'>
        <CommandEmpty>{t('No conversations yet')}</CommandEmpty>
        {convs.length > 0 && (
          <CommandGroup heading={t('Recent conversations')}>
            {convs.map((c) => (
              <CommandItem
                key={c.id}
                value={`${c.title} ${c.id}`}
                onSelect={() => {
                  select(c.id)
                  props.onPicked()
                }}
                className={cn('bc-mi', c.id === curId && 'bc-mi-cur')}
              >
                <span className='bc-mi-tx'>
                  <span className='truncate'>{c.title}</span>
                </span>
                <span className='bc-price'>{ago(c.updatedAt)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  )
}

function HistoryMenu(props: { title: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type='button'
            className='bc-ttl'
            aria-label={t('Recent conversations')}
          >
            <span>{props.title}</span>
            <ChevronDown className='bc-chev' aria-hidden='true' />
          </button>
        }
      />
      <PopoverContent align='start' className='bc-menu w-[320px] gap-0 p-0'>
        <HistoryList onPicked={() => setOpen(false)} />
        <p className='bc-menu-foot'>
          {t('Conversations are kept only in this browser.')}
        </p>
      </PopoverContent>
    </Popover>
  )
}

type TopbarProps = {
  artifacts: number
  panelOpen: boolean
  onTogglePanel: () => void
  onNew: () => void
}

export const Topbar = memo(function Topbar(props: TopbarProps) {
  const { t } = useTranslation()
  const curId = useBearChatStore((s) => s.curId)
  const convTitle = useBearChatStore(
    (s) => currentConversation(s)?.title ?? null
  )
  const hasConvs = useBearChatStore((s) => s.convs.length > 0)
  const liveHere = useBearChatStore(
    (s) => s.live !== null && s.live.convId === s.curId
  )
  const updateConv = useBearChatStore((s) => s.updateConv)
  const removeConv = useBearChatStore((s) => s.removeConv)
  const putConv = useBearChatStore((s) => s.putConv)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [codeOpen, setCodeOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const title = convTitle ?? t('New conversation')
  const conv = () => currentConversation(useBearChatStore.getState())
  const labels = {
    user: t('You'),
    system: t('System prompt'),
    image: t('Picture'),
  }

  const finishRename = (save: boolean) => {
    if (save && curId && name.trim()) {
      updateConv(curId, (c) => ({
        ...c,
        title: name.trim().slice(0, 80),
        named: true,
      }))
    }
    setRenaming(false)
  }

  const importFile = async (file: File) => {
    try {
      const list = fromJson(await file.text())
      const known = new Set(useBearChatStore.getState().convs.map((c) => c.id))
      let added = 0
      for (const c of list) {
        if (known.has(c.id)) continue
        putConv(c)
        added += 1
      }
      toast.success(t('Imported {{count}} conversations', { count: added }))
    } catch {
      toast.error(t('This file is not a chat export'))
    }
  }

  return (
    <div className='bc-top'>
      {renaming && curId ? (
        <input
          className='bc-ttl-input'
          autoFocus
          value={name}
          maxLength={80}
          aria-label={t('Conversation name')}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => finishRename(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') finishRename(true)
            if (e.key === 'Escape') finishRename(false)
          }}
        />
      ) : (
        <HistoryMenu title={title} />
      )}
      <span className='bc-grow' />
      {props.artifacts > 0 && (
        <button
          type='button'
          className={cn('bc-tbtn bc-artbtn', props.panelOpen && 'bc-on')}
          aria-pressed={props.panelOpen}
          onClick={props.onTogglePanel}
        >
          <PanelRight aria-hidden='true' />
          <span className='bc-hide-sm'>{t('Chat artifacts')}</span>
          <span className='bc-count'>{props.artifacts}</span>
        </button>
      )}
      <DropdownMenu>
        <Tip label={t('More')}>
          <DropdownMenuTrigger
            render={
              <button
                type='button'
                className='bc-tbtn bc-icon'
                aria-label={t('More')}
              >
                <Ellipsis aria-hidden='true' />
              </button>
            }
          />
        </Tip>
        <DropdownMenuContent align='end' className='bc-menu w-60 p-1.5'>
          <DropdownMenuItem
            disabled={!curId}
            onClick={() => {
              setName(convTitle ?? '')
              setRenaming(true)
            }}
          >
            <Pencil aria-hidden='true' />
            {t('Rename')}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!curId} onClick={() => setCodeOpen(true)}>
            <Code2 aria-hidden='true' />
            {t('Use this in your code')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!curId}
            onClick={() => {
              const c = conv()
              if (c) {
                downloadText(
                  `${fileSafe(c.title)}.md`,
                  toMarkdown(c, labels),
                  'text/markdown'
                )
              }
            }}
          >
            <Download aria-hidden='true' />
            {t('Export as Markdown')}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!hasConvs}
            onClick={() =>
              downloadText(
                'xiaoxiong-chats.json',
                toJson(useBearChatStore.getState().convs),
                'application/json'
              )
            }
          >
            <FileJson aria-hidden='true' />
            {t('Export all conversations')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => fileRef.current?.click()}>
            <Upload aria-hidden='true' />
            {t('Import conversations')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant='destructive'
            disabled={!curId || liveHere}
            onClick={() => setConfirm(true)}
          >
            <Trash2 aria-hidden='true' />
            {t('Delete conversation')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Tip label={t('New conversation')}>
        <button type='button' className='bc-tbtn' onClick={props.onNew}>
          <SquarePen aria-hidden='true' />
          <span className='bc-hide-sm'>{t('New conversation')}</span>
        </button>
      </Tip>
      <input
        ref={fileRef}
        type='file'
        accept='application/json,.json'
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void importFile(file)
        }}
      />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        destructive
        title={t('Delete this conversation?')}
        desc={t('It is removed from this browser and cannot be brought back.')}
        confirmText={t('Delete')}
        handleConfirm={() => {
          if (curId) removeConv(curId)
          setConfirm(false)
        }}
      />
      <CodeDialog
        open={codeOpen}
        onOpenChange={setCodeOpen}
        body={curId ? lastRequest(curId) : undefined}
      />
    </div>
  )
})
