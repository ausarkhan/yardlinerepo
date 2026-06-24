import { Link } from "react-router-dom";
import { Clock, CheckCircle2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SmartImage } from "@/components/common/SmartImage";
import { StarRating } from "@/components/common/StarRating";
import type { ServiceProvider } from "@/lib/types";
import {
  providerImage,
  providerName,
  avatarUrl,
  initials,
  titleCase,
} from "@/lib/helpers";

interface ProviderCardProps {
  provider: ServiceProvider;
  rating?: number;
  reviewCount?: number;
  index?: number;
}

export function ProviderCard({ provider, rating = 0, reviewCount = 0, index = 0 }: ProviderCardProps) {
  const name = providerName(provider);

  return (
    <Link
      to={`/provider/${provider.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card card-hover animate-fade-up"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms`, animationFillMode: "both" }}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        <SmartImage
          src={providerImage(provider)}
          alt={name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3">
          {provider.category ? (
            <Badge className="border-0 bg-background/90 text-foreground backdrop-blur">
              {titleCase(provider.category)}
            </Badge>
          ) : null}
        </div>
        {provider.is_available ? (
          <div className="absolute right-3 top-3">
            <Badge className="border-0 bg-green text-white">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Available
            </Badge>
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-11 w-11 border-2 border-background shadow-sm">
            <AvatarImage src={avatarUrl(provider.user_data?.avatar)} alt={name} />
            <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-semibold">
              {initials(name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h3 className="truncate font-heading text-base font-bold">{name}</h3>
            <StarRating value={rating} count={reviewCount} size={12} />
          </div>
        </div>

        <p className="line-clamp-2 text-sm text-muted-foreground">
          {provider.description || "Trusted student provider on campus."}
        </p>

        {provider.response_time ? (
          <p className="mt-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Responds {provider.response_time}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
