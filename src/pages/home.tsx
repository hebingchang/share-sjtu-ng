import { Book, CircleCheck, Clock, Magnifier } from '@gravity-ui/icons'
import { Button, Card, Kbd, Label, SearchField } from '@heroui/react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../auth/context'

const SUGGESTED_KEYWORDS = ['大学物理', '概率统计', '高等数学', '线性代数']

export default function HomePage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) {
        return
      }
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }
      event.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const goToSearch = (term: string) => {
    navigate(`/search?q=${encodeURIComponent(term)}`)
  }

  const submitSearch = () => {
    const query = keyword.trim()
    if (query) {
      goToSearch(query)
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">
          欢迎回来{profile?.name ? `，${profile.name}` : ''}
        </h1>
        <p className="text-sm text-muted lg:text-base">
          在这里浏览、分享并传承交大课程资料。
        </p>
      </header>

      <section className="relative isolate overflow-hidden rounded-3xl border border-default bg-surface-secondary px-6 py-12 sm:px-10 sm:py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-accent/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-16 size-72 rounded-full bg-accent/[0.06] blur-3xl"
        />

        <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              今天想找哪门课？
            </h2>
            <p className="text-sm text-muted sm:text-base">
              搜索课程名或课程代码，快速进入资料列表。
            </p>
          </div>

          <div className="w-full">
            <SearchField
              className="w-full"
              name="course-search"
              value={keyword}
              onChange={setKeyword}
              onSubmit={submitSearch}
            >
              <Label className="sr-only">搜索课程</Label>
              <SearchField.Group className="h-14 w-full rounded-full pr-2 shadow-field transition data-[focus-within=true]:ring-2 data-[focus-within=true]:ring-accent/40 sm:h-16">
                <SearchField.SearchIcon className="ml-5 size-5" />
                <SearchField.Input
                  ref={inputRef}
                  className="w-full min-w-0 px-3 text-base sm:text-lg"
                  placeholder="搜索课程名或课程代码"
                />
                {keyword ? null : (
                  <Kbd aria-hidden className="mr-2 hidden sm:inline-flex">
                    <Kbd.Content>/</Kbd.Content>
                  </Kbd>
                )}
                <Button
                  isIconOnly
                  aria-label="搜索课程"
                  className="hidden size-10 shrink-0 rounded-full sm:inline-flex sm:size-12"
                  isDisabled={!keyword.trim()}
                  onPress={submitSearch}
                >
                  <Magnifier className="size-4 sm:size-5" />
                </Button>
              </SearchField.Group>
            </SearchField>

            <Button
              className="mt-3 h-12 w-full sm:hidden"
              isDisabled={!keyword.trim()}
              onPress={submitSearch}
            >
              <Magnifier className="size-4" />
              搜索
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-muted">热门搜索</span>
            {SUGGESTED_KEYWORDS.map((term) => (
              <button
                key={term}
                className="rounded-full border border-default bg-surface px-3 py-1 text-xs font-medium text-muted transition-colors hover:border-accent/40 hover:bg-surface-secondary hover:text-foreground"
                type="button"
                onClick={() => goToSearch(term)}
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <Book className="size-6 text-muted" />
          <Card.Header>
            <Card.Title>浏览课程</Card.Title>
            <Card.Description>
              查找过往学长学姐留下的课程笔记、真题和复习资料。
            </Card.Description>
          </Card.Header>
        </Card>

        <Card>
          <Clock className="size-6 text-muted" />
          <Card.Header>
            <Card.Title>最近上传</Card.Title>
            <Card.Description>
              跟踪你最近分享的资料，随时更新或下架。
            </Card.Description>
          </Card.Header>
        </Card>

        <Card>
          <CircleCheck className="size-6 text-muted" />
          <Card.Header>
            <Card.Title>我的积分</Card.Title>
            <Card.Description>每次分享资料都会获得更多积分。</Card.Description>
          </Card.Header>
          <Card.Content>
            <p className="text-3xl font-semibold tracking-tight text-foreground">
              {profile?.points?.points ?? 0}
            </p>
          </Card.Content>
        </Card>
      </section>
    </div>
  )
}
