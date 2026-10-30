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
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm, type SubmitErrorHandler } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { DateTimePicker } from '@/components/datetime-picker'
import { Dialog } from '@/components/dialog'
import { sideDrawerSwitchItemClassName } from '@/components/drawer-layout'
import { MultiSelect } from '@/components/multi-select'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { DialogClose } from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { RelatedPolicyLink } from '@/features/system-settings/request-policies/related-policy-link'
import { useStatus } from '@/hooks/use-status'
import { getUserModels, getUserGroups } from '@/lib/api'
import { getCurrencyDisplay, getCurrencyLabel } from '@/lib/currency'
import { handleServerError } from '@/lib/handle-server-error'
import {
  requireServerSuccess,
  translateServerText,
} from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import {
  createApiKey,
  updateApiKey,
  getApiKey,
  getTokenAutoGroups,
} from '../api'
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants'
import {
  getApiKeyFormSchema,
  type ApiKeyFormValues,
  getApiKeyFormDefaultValues,
  keyUsesMoreSettings,
  transformFormDataToPayload,
  transformApiKeyToFormDefaults,
} from '../lib'
import type { ApiKey } from '../types'
import {
  ApiKeyGroupCombobox,
  type ApiKeyGroupOption,
} from './api-key-group-combobox'
import { useApiKeys } from './api-keys-provider'
import { AutoGroupOrderEditor } from './auto-group-order-editor'

/** Expiry choices; `custom` shows the date picker. */
const EXPIRY_CHOICES = [
  { id: 'never', label: 'Never expires', days: 0, hours: 0 },
  { id: '1h', label: '1 hour', days: 0, hours: 1 },
  { id: '1d', label: '1 day', days: 1, hours: 0 },
  { id: '7d', label: '7 days', days: 7, hours: 0 },
  { id: '30d', label: '30 days', days: 30, hours: 0 },
  { id: '90d', label: '90 days', days: 90, hours: 0 },
  { id: '1y', label: '1 year', days: 365, hours: 0 },
  { id: 'custom', label: 'Custom', days: 0, hours: 0 },
] as const
type ExpiryChoice = (typeof EXPIRY_CHOICES)[number]['id']

function quotaTextOf(values: ApiKeyFormValues): string {
  return values.unlimited_quota ? '' : String(values.remain_quota_dollars ?? '')
}

type ApiKeyMutateDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: ApiKey
}

/**
 * Create / edit an API key in a small centred dialog (after OpenModel):
 * name, quota (empty = no limit) and expiry up front; group, model limits,
 * IP allow-list, quota query and batch size under 「更多设置」.
 * The name stays from the drawer it replaced.
 */
export function ApiKeysMutateDrawer({
  open,
  onOpenChange,
  currentRow,
}: ApiKeyMutateDrawerProps) {
  const { t } = useTranslation()
  const isUpdate = !!currentRow
  const currentRowId = currentRow?.id
  const { triggerRefresh } = useApiKeys()
  const { status, loading: statusLoading } = useStatus()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [expiryChoice, setExpiryChoice] = useState<ExpiryChoice>('never')
  const [quotaText, setQuotaText] = useState('')
  const [initializedTarget, setInitializedTarget] = useState<string | null>(
    null
  )
  const defaultUseAutoGroup = status?.default_use_auto_group === true

  // Fetch models
  const { data: modelsData } = useQuery({
    queryKey: ['user-models'],
    queryFn: async () => requireServerSuccess(await getUserModels()),
    enabled: open,
    staleTime: 0,
  })

  // Fetch groups
  const {
    data: groupsData,
    isFetched: groupsFetched,
    isFetching: groupsFetching,
  } = useQuery({
    queryKey: ['user-groups'],
    queryFn: async () => requireServerSuccess(await getUserGroups()),
    enabled: open,
    staleTime: 0,
  })

  const {
    data: apiKeyData,
    isFetched: apiKeyFetched,
    isFetching: apiKeyFetching,
  } = useQuery({
    queryKey: ['api-key', currentRowId],
    queryFn: async () =>
      requireServerSuccess(await getApiKey(currentRowId ?? 0)),
    enabled: open && isUpdate && currentRowId !== undefined,
    staleTime: 0,
  })

  const {
    data: autoGroupsData,
    isFetched: autoGroupsFetched,
    isFetching: autoGroupsFetching,
  } = useQuery({
    queryKey: ['token-auto-groups'],
    queryFn: async () => requireServerSuccess(await getTokenAutoGroups()),
    enabled: open,
    staleTime: 0,
  })

  const models = modelsData?.data || []
  const groups = useMemo<ApiKeyGroupOption[]>(
    () =>
      Object.entries(groupsData?.data || {}).map(([key, info]) => ({
        value: key,
        label: key,
        desc: info.desc ? translateServerText(t, info.desc) : key,
        ratio: info.ratio,
      })),
    [groupsData, t]
  )
  const backendHasAuto = groups.some((g) => g.value === 'auto')
  const availableAutoGroupNames = useMemo(
    () => groups.filter((group) => group.value !== 'auto').map((g) => g.value),
    [groups]
  )
  const globalAutoGroups = useMemo(() => {
    const available = new Set(availableAutoGroupNames)
    return (autoGroupsData?.data?.groups || []).filter((group) =>
      available.has(group)
    )
  }, [autoGroupsData, availableAutoGroupNames])
  const globalAutoGroupOptions = useMemo(() => {
    const groupsByValue = new Map(groups.map((group) => [group.value, group]))
    return globalAutoGroups.flatMap((group) => {
      const option = groupsByValue.get(group)
      return option ? [option] : []
    })
  }, [globalAutoGroups, groups])
  const maxAutoGroups =
    Number.isInteger(autoGroupsData?.data?.max_count) &&
    Number(autoGroupsData?.data?.max_count) > 0
      ? Number(autoGroupsData?.data?.max_count)
      : 5
  const schema = useMemo(
    () => getApiKeyFormSchema(t, maxAutoGroups),
    [t, maxAutoGroups]
  )

  const form = useForm<ApiKeyFormValues>({
    resolver: zodResolver(schema),
    defaultValues: getApiKeyFormDefaultValues(defaultUseAutoGroup),
  })

  // Load existing data when updating
  useEffect(() => {
    if (!open) {
      form.reset(
        getApiKeyFormDefaultValues(defaultUseAutoGroup && backendHasAuto)
      )
      setInitializedTarget(null)
      return
    }
    if (
      !groupsFetched ||
      groupsFetching ||
      !autoGroupsFetched ||
      autoGroupsFetching
    ) {
      return
    }
    if (isUpdate && (!apiKeyFetched || apiKeyFetching)) return
    if (!isUpdate && statusLoading) return

    const target = isUpdate && currentRow ? `update:${currentRow.id}` : 'create'
    if (initializedTarget === target) return
    if (isUpdate && currentRow) {
      if (apiKeyData?.success && apiKeyData.data) {
        const values = transformApiKeyToFormDefaults(
          apiKeyData.data,
          availableAutoGroupNames,
          maxAutoGroups
        )
        form.reset(values)
        setQuotaText(quotaTextOf(values))
        setExpiryChoice(values.expired_time ? 'custom' : 'never')
        // Show the extra settings this key already uses
        setAdvancedOpen(
          keyUsesMoreSettings(
            values,
            getApiKeyFormDefaultValues(defaultUseAutoGroup && backendHasAuto)
          )
        )
        setInitializedTarget(target)
      }
    } else {
      const values = getApiKeyFormDefaultValues(
        defaultUseAutoGroup && backendHasAuto
      )
      form.reset(values)
      setQuotaText(quotaTextOf(values))
      setExpiryChoice('never')
      setAdvancedOpen(false)
      setInitializedTarget(target)
    }
  }, [
    open,
    isUpdate,
    currentRow,
    form,
    defaultUseAutoGroup,
    statusLoading,
    backendHasAuto,
    groupsFetched,
    groupsFetching,
    autoGroupsFetched,
    autoGroupsFetching,
    apiKeyData,
    apiKeyFetched,
    apiKeyFetching,
    availableAutoGroupNames,
    maxAutoGroups,
    initializedTarget,
  ])

  const formTarget =
    isUpdate && currentRow ? `update:${currentRow.id}` : 'create'
  const isFormInitialized = initializedTarget === formTarget
  const selectedGroup = form.watch('group')

  // Correct group after groups load: if the form value is not in available groups, fall back
  useEffect(() => {
    if (groups.length === 0) return
    const currentGroup = selectedGroup
    if (currentGroup && !groups.some((g) => g.value === currentGroup)) {
      const fallback =
        groups.find((g) => g.value === 'default')?.value ??
        groups[0]?.value ??
        ''
      form.setValue('group', fallback)
      if (currentGroup === 'auto') {
        form.setValue('auto_groups', [])
        form.setValue('auto_groups_mode', 'inherit')
        form.setValue('cross_group_retry', false)
      }
    }
  }, [groups, form, selectedGroup])

  const onSubmit = async (data: ApiKeyFormValues) => {
    setIsSubmitting(true)
    try {
      const basePayload = transformFormDataToPayload(data)

      if (isUpdate && currentRow) {
        const result = await updateApiKey({
          ...basePayload,
          id: currentRow.id,
        })
        if (result.success) {
          toast.success(t(SUCCESS_MESSAGES.API_KEY_UPDATED))
          onOpenChange(false)
          triggerRefresh()
        } else {
          handleServerError(result, t(ERROR_MESSAGES.UPDATE_FAILED))
        }
      } else {
        // Create mode - handle batch creation
        const count = data.tokenCount || 1
        let successCount = 0

        for (let i = 0; i < count; i++) {
          const result = await createApiKey({
            ...basePayload,
            name:
              i === 0 && data.name
                ? data.name
                : `${data.name || 'default'}-${Math.random().toString(36).slice(2, 8)}`,
          })
          if (result.success) {
            successCount++
          } else {
            handleServerError(result, t(ERROR_MESSAGES.CREATE_FAILED))
            break
          }
        }

        if (successCount > 0) {
          toast.success(
            t('Successfully created {{count}} API Key(s)', {
              count: successCount,
            })
          )
          onOpenChange(false)
          triggerRefresh()
        }
      }
    } catch (error) {
      handleServerError(error, t(ERROR_MESSAGES.UNEXPECTED))
    } finally {
      setIsSubmitting(false)
    }
  }

  const onInvalid: SubmitErrorHandler<ApiKeyFormValues> = () => {
    toast.error(t('Please fix the highlighted fields before saving'))
  }

  const handleExpiryChoice = (choice: ExpiryChoice) => {
    setExpiryChoice(choice)
    const preset = EXPIRY_CHOICES.find((item) => item.id === choice)
    if (choice === 'never') {
      form.setValue('expired_time', null, { shouldDirty: true })
    } else if (choice !== 'custom' && preset) {
      const date = new Date()
      date.setDate(date.getDate() + preset.days)
      date.setHours(date.getHours() + preset.hours)
      form.setValue('expired_time', date, { shouldDirty: true })
    } else if (!form.getValues('expired_time')) {
      const date = new Date()
      date.setDate(date.getDate() + 30)
      form.setValue('expired_time', date, { shouldDirty: true })
    }
  }

  // Empty means no limit, so the switch is gone from the form
  const handleQuotaText = (text: string, badInput: boolean) => {
    setQuotaText(text)
    // 「1e」 or letters: the number box reports bad input with an empty value.
    // Keep a limit and let the schema reject it, rather than read it as "no
    // limit" while the box still shows the text
    if (badInput) {
      form.setValue('unlimited_quota', false, { shouldDirty: true })
      form.setValue('remain_quota_dollars', Number.NaN, {
        shouldDirty: true,
        shouldValidate: true,
      })
      return
    }
    const amount = Number.parseFloat(text)
    if (text.trim() === '' || Number.isNaN(amount)) {
      form.setValue('unlimited_quota', true, { shouldDirty: true })
      return
    }
    form.setValue('unlimited_quota', false, { shouldDirty: true })
    form.setValue('remain_quota_dollars', amount, {
      shouldDirty: true,
      shouldValidate: true,
    })
  }

  const { meta: currencyMeta } = getCurrencyDisplay()
  const currencyLabel = getCurrencyLabel()
  const tokensOnly = currencyMeta.kind === 'tokens'
  const quotaLabel = t('Quota ({{currency}})', { currency: currencyLabel })

  const autoGroupsMode = form.watch('auto_groups_mode')
  // One group means there is nothing to choose
  const showGroup = groups.length > 1
  let submitLabel = isUpdate ? t('Save changes') : t('Create')
  if (isSubmitting) submitLabel = t('Saving...')

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isUpdate ? t('Update API Key') : t('Create API Key')}
      description={
        isUpdate
          ? t('Update the API key by providing necessary info.')
          : t('Add a new API key by providing necessary info.')
      }
      // A small dialog: keep the 16px padding at every width
      contentClassName='sm:max-w-md sm:p-4'
      footerClassName='sm:-mx-4 sm:-mb-4 sm:p-4'
      footer={
        <>
          <DialogClose render={<Button variant='outline' />}>
            {t('Cancel')}
          </DialogClose>
          <Button
            type='button'
            onClick={form.handleSubmit(onSubmit, onInvalid)}
            disabled={!isFormInitialized || isSubmitting}
          >
            {submitLabel}
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form
          id='api-key-form'
          onSubmit={form.handleSubmit(onSubmit, onInvalid)}
          aria-busy={!isFormInitialized}
          inert={!isFormInitialized || isSubmitting ? true : undefined}
          className='flex flex-col gap-4'
        >
          <FormField
            control={form.control}
            name='name'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Name')}</FormLabel>
                <FormControl>
                  <Input {...field} placeholder={t('e.g. Claude Code')} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='remain_quota_dollars'
            render={() => (
              <FormItem>
                <FormLabel>{quotaLabel}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    inputMode='decimal'
                    min={0}
                    step={tokensOnly ? 1 : 0.01}
                    value={quotaText}
                    placeholder={t('Leave empty for no limit')}
                    onChange={(e) =>
                      handleQuotaText(
                        e.target.value,
                        e.target.validity.badInput
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='expired_time'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Expiration')}</FormLabel>
                <Select
                  value={expiryChoice}
                  onValueChange={(value) =>
                    handleExpiryChoice(value as ExpiryChoice)
                  }
                >
                  <FormControl>
                    <SelectTrigger className='w-full'>
                      <SelectValue>
                        {t(
                          EXPIRY_CHOICES.find(
                            (item) => item.id === expiryChoice
                          )?.label ?? 'Never expires'
                        )}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {EXPIRY_CHOICES.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {t(item.label)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {expiryChoice === 'custom' && (
                  <DateTimePicker
                    value={field.value ?? undefined}
                    onChange={(date) => field.onChange(date ?? null)}
                    placeholder={t('Never expires')}
                    className='min-w-0 [&_input[type=time]]:w-28'
                  />
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger
              render={
                <Button
                  type='button'
                  variant='link'
                  // a quiet text toggle, not a button-looking control
                  className='text-muted-foreground hover:text-foreground h-auto gap-1 rounded-md border-0 px-0 font-normal hover:no-underline'
                />
              }
            >
              <ChevronDown
                className={cn(
                  'size-4 -rotate-90 transition-transform',
                  advancedOpen && 'rotate-0'
                )}
              />
              {t('More settings')}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className='flex flex-col gap-4 pt-4'>
                {showGroup && (
                  <FormField
                    control={form.control}
                    name='group'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Group')}</FormLabel>
                        <FormControl>
                          <ApiKeyGroupCombobox
                            options={groups}
                            value={field.value}
                            onValueChange={(group) => {
                              field.onChange(group)
                              form.setValue(
                                'cross_group_retry',
                                group === 'auto',
                                { shouldDirty: true }
                              )
                            }}
                            placeholder={t('Select a group')}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {showGroup && selectedGroup === 'auto' && (
                  <FormField
                    control={form.control}
                    name='auto_groups'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Auto group order')}</FormLabel>
                        <FormDescription>
                          {t(
                            'Choose and order the groups this API key will try.'
                          )}
                        </FormDescription>
                        <FormControl>
                          <AutoGroupOrderEditor
                            value={field.value}
                            mode={autoGroupsMode}
                            options={groups}
                            globalOptions={globalAutoGroupOptions}
                            maxCount={maxAutoGroups}
                            onChange={(value) => {
                              form.setValue('auto_groups_mode', value.mode, {
                                shouldDirty: true,
                                shouldValidate: false,
                              })
                              form.setValue(
                                'auto_groups',
                                value.groups.slice(0, maxAutoGroups),
                                {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                }
                              )
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {showGroup && selectedGroup === 'auto' && (
                  <FormField
                    control={form.control}
                    name='cross_group_retry'
                    render={({ field }) => (
                      <FormItem className={sideDrawerSwitchItemClassName()}>
                        <div className='flex flex-col gap-0.5'>
                          <FormLabel className='text-sm'>
                            {t('Cross-group retry')}
                          </FormLabel>
                          <FormDescription className='text-xs'>
                            {t(
                              'When enabled, if channels in the current group fail, it will try channels in the next group in order.'
                            )}
                            <RelatedPolicyLink section='routing' />
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={!!field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name='model_limits'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Model Limits')}</FormLabel>
                      <FormControl>
                        <MultiSelect
                          options={models.map((m) => ({
                            label: m,
                            value: m,
                          }))}
                          selected={field.value}
                          onChange={field.onChange}
                          placeholder={t('Select models (empty for allow all)')}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='allow_ips'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('IP Whitelist (supports CIDR)')}</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          className='min-h-20 resize-none'
                          placeholder={t(
                            'One IP per line (empty for no restriction)'
                          )}
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='allow_user_quota_query'
                  render={({ field }) => (
                    <FormItem className={sideDrawerSwitchItemClassName()}>
                      <div className='flex flex-col gap-0.5'>
                        <FormLabel className='text-sm'>
                          {t('Allow querying user quota')}
                        </FormLabel>
                        <FormDescription className='text-xs'>
                          {t(
                            "When enabled, this API key can be used to check your account's remaining and used quota."
                          )}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {!isUpdate && (
                  <FormField
                    control={form.control}
                    name='tokenCount'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Quantity')}</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type='number'
                            min='1'
                            placeholder={t('Number of keys to create')}
                            onChange={(e) =>
                              field.onChange(
                                Number.parseInt(e.target.value, 10) || 1
                              )
                            }
                          />
                        </FormControl>
                        <FormDescription>
                          {t(
                            'Create multiple API keys at once (random suffix will be added to names)'
                          )}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </form>
      </Form>
    </Dialog>
  )
}
