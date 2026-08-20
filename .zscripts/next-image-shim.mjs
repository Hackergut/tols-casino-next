import React from "react";
export default function Image(props) {
  const { src, alt, fill, priority, sizes, quality, loader, ...rest } = props;
  return React.createElement("img", { src, alt, ...rest });
}
